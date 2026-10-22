import { normalize, signedDistance } from './model/math.js';
import type { Box } from './layout.js';

export interface PackingItem {
  id: string;
  angle: number;
  width: number;
  height: number;
  limit: number;
}
interface Node {
  item?: PackingItem;
  desired: number;
  half: number;
}
export interface PackedLabel {
  id: string;
  angle: number;
  radius: number;
  box: Box;
}
const radians = Math.PI / 180;

function gap(a: Node, b: Node): number {
  // Obstacle intervals are already expanded by the largest label radius.
  return !a.item && !b.item ? 0 : !a.item ? a.half : !b.item ? b.half : a.half + b.half;
}

/** Bounded circular difference constraints, followed by least-squares projection. */
function solve(nodes: Node[]): { angles?: number[]; conflict: string[] } {
  const n = nodes.length;
  if (!n) return { angles: [], conflict: [] };
  const edges = nodes.map((node, i) => gap(node, nodes[(i + 1) % n]!) - (i === n - 1 ? 360 : 0));
  function feasible(distance: number): { angles?: number[]; conflict: string[] } {
    const lower = nodes.map(
      (node) => node.desired - (node.item ? Math.min(distance, node.item.limit) : 0),
    );
    const upper = nodes.map(
      (node) => node.desired + (node.item ? Math.min(distance, node.item.limit) : 0),
    );
    const origins = nodes.map((_, i) => i);
    for (let pass = 0; pass <= n; pass++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const next = lower[i]! + edges[i]!;
        if (next <= lower[j]! + 1e-8) continue;
        lower[j] = next;
        origins[j] = origins[i]!;
        changed = true;
        if (next > upper[j]! + 1e-7 || pass === n) {
          const conflict: string[] = [];
          for (let k = origins[i]!, steps = 0; steps <= n; k = (k + 1) % n, steps++) {
            if (nodes[k]!.item) conflict.push(nodes[k]!.item!.id);
            if (k === j && steps > 0) break;
          }
          return { conflict: [...new Set(conflict)] };
        }
      }
      if (!changed) return { angles: lower, conflict: [] };
    }
    return { conflict: nodes.flatMap((node) => (node.item ? [node.item.id] : [])) };
  }
  const bound = feasible(30);
  if (!bound.angles) return bound;
  let low = 0,
    high = 30;
  for (let i = 0; i < 20; i++) {
    const middle = (low + high) / 2;
    if (feasible(middle).angles) high = middle;
    else low = middle;
  }
  const distance = Math.min(30, high + 0.001);
  const fallback = feasible(distance).angles!;
  // Subtract cumulative separations to turn the row into bounded isotonic
  // regression. Pool-adjacent-violators solves the least-squares problem in
  // linear time without moving isolated symbols to a feasible lower bound.
  const prefix = nodes.map(() => 0);
  for (let i = 1; i < n; i++) prefix[i] = prefix[i - 1]! + edges[i - 1]!;
  const target = nodes.map((node, i) => node.desired - prefix[i]!);
  const lower = nodes.map(
    (node, i) => target[i]! - (node.item ? Math.min(distance, node.item.limit) : 0),
  );
  const upper = nodes.map(
    (node, i) => target[i]! + (node.item ? Math.min(distance, node.item.limit) : 0),
  );
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  type Block = {
    start: number;
    end: number;
    sum: number;
    count: number;
    low: number;
    high: number;
    value: number;
  };
  const blocks: Block[] = [];
  for (let i = 0; i < n; i++) {
    blocks.push({
      start: i,
      end: i,
      sum: target[i]!,
      count: 1,
      low: lower[i]!,
      high: upper[i]!,
      value: target[i]!,
    });
    while (blocks.length > 1 && blocks.at(-2)!.value > blocks.at(-1)!.value) {
      const last = blocks.pop()!,
        previous = blocks.pop()!;
      const block = {
        start: previous.start,
        end: last.end,
        sum: previous.sum + last.sum,
        count: previous.count + last.count,
        low: Math.max(previous.low, last.low),
        high: Math.min(previous.high, last.high),
        value: 0,
      };
      block.value = clamp(block.sum / block.count, block.low, block.high);
      blocks.push(block);
    }
  }
  const z = nodes.map(() => 0);
  for (const block of blocks) for (let i = block.start; i <= block.end; i++) z[i] = block.value;
  // The last-to-first circular constraint limits the isotonic values' range.
  // Find the least-squares common window; clipping preserves isotonic order.
  const slack = -edges[n - 1]! - prefix[n - 1]!;
  let windowLow = Math.max(...lower.map((value) => value - slack));
  let windowHigh = Math.min(...upper);
  if (z[n - 1]! - z[0]! > slack) {
    for (let pass = 0; pass < 40; pass++) {
      const middle = (windowLow + windowHigh) / 2;
      const derivative = z.reduce(
        (sum, value, i) =>
          sum +
          (value < middle
            ? middle - target[i]!
            : value > middle + slack
              ? middle + slack - target[i]!
              : 0),
        0,
      );
      if (derivative < 0) windowLow = middle;
      else windowHigh = middle;
    }
    const start = (windowLow + windowHigh) / 2;
    for (let i = 0; i < n; i++) z[i] = clamp(z[i]!, start, start + slack);
  }
  const x = z.map((value, i) => value + prefix[i]!);
  const valid = nodes.every(
    (node, i) =>
      Math.abs(x[i]! - node.desired) <=
        (node.item ? Math.min(distance, node.item.limit) : 0) + 1e-6 &&
      x[(i + 1) % n]! - x[i]! >= edges[i]! - 1e-6,
  );
  return { angles: valid ? x : fallback, conflict: [] };
}

/** Collective, deterministic one/two-row packing; all dimensions are wheel units. */
export function packLabels(
  input: readonly PackingItem[],
  band: { inner: number; outer: number; preferred: number },
  padding: number,
  obstacles: readonly Box[],
): { placements?: PackedLabel[]; conflict: string[] } {
  const items = [...input].sort(
    (a, b) => normalize(a.angle) - normalize(b.angle) || a.id.localeCompare(b.id),
  );
  if (!items.length) return { placements: [], conflict: [] };
  const diagonal = (item: PackingItem) => Math.hypot(item.width, item.height) / 2;
  const largest = Math.max(...items.map(diagonal));
  const inner = band.inner + padding + largest,
    outer = band.outer - padding - largest;
  if (inner > outer) return { conflict: [items.find((item) => diagonal(item) === largest)!.id] };
  const preferred = Math.max(inner, Math.min(band.preferred, outer));
  const arrangements = [[preferred], [inner], [outer], [(inner + outer) / 2]];
  // Numeric scale labels can reserve the outside of a band. Do not force a
  // second row against that rim when two closer rows fit farther inward.
  const separation = 2 * largest + padding;
  if (outer - inner >= separation) {
    const center = Math.max(inner + separation / 2, Math.min(preferred, outer - separation / 2));
    const lower = Math.max(inner, preferred - separation),
      upper = Math.min(outer, preferred + separation);
    for (const pair of [
      [inner, outer],
      [inner, inner + separation],
      [outer - separation, outer],
      [center - separation / 2, center + separation / 2],
      [lower, lower + separation],
      [upper - separation, upper],
    ])
      arrangements.push(pair, [...pair].reverse());
  }
  let best: PackedLabel[] | undefined, bestCost: number[] | undefined;
  let conflict = items.map((item) => item.id);
  for (const radii of arrangements) {
    const placements: PackedLabel[] = [];
    let failed = false;
    for (let row = 0; row < radii.length; row++) {
      const radius = radii[row]!;
      const members = items.filter((_, i) => i % radii.length === row);
      if (!members.length) continue;
      const nodes: Node[] = members.map((item) => ({
        item,
        desired: normalize(item.angle),
        half: Math.asin(Math.min(1, (diagonal(item) + padding / 2) / radius)) / radians,
      }));
      const intervals: [number, number][] = [];
      for (const box of obstacles) {
        const r = Math.hypot(box.x, box.y),
          expanded = Math.hypot(box.width, box.height) / 2 + largest + padding;
        if (Math.abs(r - radius) >= expanded) continue;
        if (!r || expanded >= r + radius) {
          intervals.push([0, 360]);
          continue;
        }
        const half =
          Math.acos(
            Math.max(
              -1,
              Math.min(1, (r * r + radius * radius - expanded * expanded) / (2 * r * radius)),
            ),
          ) / radians;
        const center = normalize(Math.atan2(box.y, box.x) / radians - 180);
        const start = center - half,
          end = center + half;
        if (start < 0) intervals.push([0, end], [start + 360, 360]);
        else if (end > 360) intervals.push([start, 360], [0, end - 360]);
        else intervals.push([start, end]);
      }
      const merged: [number, number][] = [];
      for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
        const previous = merged.at(-1);
        if (previous && previous[1] >= interval[0])
          previous[1] = Math.max(previous[1], interval[1]);
        else merged.push([...interval]);
      }
      if (merged.length === 1 && merged[0]![0] === 0 && merged[0]![1] === 360) {
        const ids = members.map((item) => item.id);
        if (ids.length < conflict.length) conflict = ids;
        failed = true;
        break;
      }
      if (merged.length > 1 && merged[0]![0] === 0 && merged.at(-1)![1] === 360) {
        const first = merged.shift()!,
          last = merged.pop()!;
        merged.push([last[0], first[1] + 360]);
      }
      for (const [start, end] of merged)
        nodes.push({ desired: normalize((start + end) / 2), half: (end - start) / 2 });
      nodes.sort(
        (a, b) => a.desired - b.desired || (a.item?.id ?? '').localeCompare(b.item?.id ?? ''),
      );
      const result = solve(nodes);
      if (!result.angles) {
        if (
          result.conflict.length &&
          (result.conflict.length < conflict.length ||
            (result.conflict.length === conflict.length &&
              result.conflict.join() < conflict.join()))
        )
          conflict = result.conflict;
        failed = true;
        break;
      }
      nodes.forEach((node, i) => {
        if (!node.item) return;
        const angle = normalize(result.angles![i]!);
        const theta = (180 + angle) * radians;
        placements.push({
          id: node.item.id,
          angle,
          radius,
          box: {
            x: Math.cos(theta) * radius,
            y: Math.sin(theta) * radius,
            width: node.item.width,
            height: node.item.height,
          },
        });
      });
    }
    if (failed) continue;
    const overlaps = (a: Box, b: Box) =>
      Math.abs(a.x - b.x) < (a.width + b.width) / 2 + padding - 1e-6 &&
      Math.abs(a.y - b.y) < (a.height + b.height) / 2 + padding - 1e-6;
    const invalid = placements.filter(
      (p, i) =>
        obstacles.some((box) => overlaps(p.box, box)) ||
        placements.some((other, j) => j !== i && overlaps(p.box, other.box)),
    );
    if (invalid.length) {
      if (invalid.length < conflict.length) conflict = invalid.map((p) => p.id);
      continue;
    }
    const offsets = placements.map((placement) =>
      Math.abs(
        signedDistance(items.find((item) => item.id === placement.id)!.angle, placement.angle),
      ),
    );
    const cost = [
      Math.max(0, ...offsets),
      offsets.reduce((sum, value) => sum + value * value, 0),
      placements.reduce((sum, placement) => sum + (placement.radius - band.preferred) ** 2, 0),
    ];
    const better =
      !bestCost ||
      cost.some(
        (value, i) =>
          value < bestCost![i]! - 1e-6 &&
          cost.slice(0, i).every((previous, j) => Math.abs(previous - bestCost![j]!) <= 1e-6),
      );
    if (better) {
      best = placements;
      bestCost = cost;
    }
  }
  return { placements: best, conflict: best ? [] : conflict };
}
