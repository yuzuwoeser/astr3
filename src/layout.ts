import { normalize } from './model/math.js';
import type { Body } from './model/types.js';

export interface Point {
  x: number;
  y: number;
}
export interface Box extends Point {
  width: number;
  height: number;
}
export interface BodyPlacement {
  id: string;
  marker: Point;
  label: Point;
  box: Box;
  displaced: boolean;
}
export interface BodyLayout {
  placements: BodyPlacement[];
  compact: boolean;
}
export const WHEEL = {
  outer: 286,
  zodiacInner: 252,
  marker: 239,
  labelOuter: 242,
  house: 148,
  houseLabel: 133,
  extent: 330,
} as const;

/** Positive zodiac longitude proceeds counterclockwise from the ascendant at left. */
export function polar(longitude: number, radius: number, ascendant = 0): Point {
  const angle = ((180 + longitude - ascendant) * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Close or coincident endpoints need a visible loop that still joins both anchors. */
export function aspectPath(start: Point, end: Point, pixelsPerUnit: number): Point[] {
  const scale = Math.max(pixelsPerUnit, 0.05);
  if (Math.hypot(end.x - start.x, end.y - start.y) * scale >= 8) return [start, end];
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const radius = Math.hypot(middle.x, middle.y);
  const inward = { x: -middle.x / radius, y: -middle.y / radius };
  const depth = 20 / scale,
    spread = 8 / scale;
  const first = {
    x: start.x + inward.x * depth - inward.y * spread,
    y: start.y + inward.y * depth + inward.x * spread,
  };
  const second = {
    x: end.x + inward.x * depth + inward.y * spread,
    y: end.y + inward.y * depth - inward.x * spread,
  };
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16,
      u = 1 - t;
    return {
      x: u ** 3 * start.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * end.x,
      y: u ** 3 * start.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * end.y,
    };
  });
}
export function boxesOverlap(a: Box, b: Box, padding = 3): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + padding &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + padding
  );
}

/** Nearest distance of an entire rectangle from the wheel center. */
function nearestRadius(box: Box): number {
  const x = Math.abs(box.x),
    y = Math.abs(box.y);
  return Math.hypot(Math.max(0, x - box.width / 2), Math.max(0, y - box.height / 2));
}

/** Screen-sized labels stay in the planet band. Exact longitude markers never move. */
export function layoutBodies(
  bodies: readonly Body[],
  ascendant: number,
  pixelsPerUnit: number,
  measure: (body: Body, compact: boolean) => { width: number; height: number } = (
    _body,
    compact,
  ) => ({ width: compact ? 26 : 34, height: compact ? 28 : 40 }),
  reservedBoxes: readonly Box[] = [],
): BodyLayout {
  const scale = Math.max(pixelsPerUnit, 0.05);
  const padding = 4 / scale;
  const inner = WHEEL.house + padding,
    outer = WHEEL.labelOuter - padding;
  const sorted = [...bodies].sort(
    (a, b) =>
      normalize(a.longitude - ascendant) - normalize(b.longitude - ascendant) ||
      a.id.localeCompare(b.id),
  );
  function place(compact: boolean, largestFirst = false): BodyPlacement[] {
    const occupied: Box[] = [...reservedBoxes];
    const placements: BodyPlacement[] = [];
    // Wide custom glyphs have fewer valid angles. On a second pass, give them
    // those positions before smaller labels consume the available space.
    const ordered = largestFirst
      ? [...sorted].sort((a, b) => {
          const first = measure(a, compact),
            second = measure(b, compact);
          return second.width * second.height - first.width * first.height;
        })
      : sorted;
    for (const body of ordered) {
      const size = measure(body, compact);
      const width = size.width / scale,
        height = size.height / scale;
      let chosen: Box | undefined;
      let displacement = 0;
      // Search nearby angles first. Derive the usable radial interval from the
      // whole label rectangle, not its center or just its corners at the inner rim.
      for (let step = 0; step <= 90 && !chosen; step++) {
        const offsets = step === 0 ? [0] : [step * 2, -step * 2];
        for (const offset of offsets) {
          const direction = polar(body.longitude + offset, 1, ascendant);
          const projection = (Math.abs(direction.x) * width + Math.abs(direction.y) * height) / 2;
          const discriminant = projection ** 2 + outer ** 2 - (width ** 2 + height ** 2) / 4;
          if (outer <= inner || discriminant <= 0) continue;
          const maxRadius = Math.sqrt(discriminant) - projection;
          const nearAt = (radius: number) =>
            nearestRadius({ x: direction.x * radius, y: direction.y * radius, width, height });
          if (maxRadius <= 0 || nearAt(maxRadius) < inner) continue;
          // Distance to a rectangle is monotonic along this ray. Find its first
          // position clearing the inner circle, then sample only this valid band.
          let low = 0,
            high = maxRadius;
          for (let iteration = 0; iteration < 24; iteration++) {
            const mid = (low + high) / 2;
            if (nearAt(mid) < inner) low = mid;
            else high = mid;
          }
          const minRadius = high;
          const preferred = Math.max(minRadius, Math.min(214, maxRadius));
          const radii = [preferred, maxRadius, minRadius];
          for (let radius = maxRadius - 6 / scale; radius > minRadius; radius -= 6 / scale)
            radii.push(radius);
          for (const radius of radii) {
            const point = polar(body.longitude + offset, radius, ascendant);
            const box = { ...point, width, height };
            if (!occupied.some((other) => boxesOverlap(box, other, padding))) {
              chosen = box;
              displacement = offset;
              break;
            }
          }
          if (chosen) break;
        }
      }
      // A bounded search may run out of space. The renderer keeps that body's
      // marker selectable instead of placing its label inside a ring or offscreen.
      if (!chosen) continue;
      occupied.push(chosen);
      placements.push({
        id: body.id,
        marker: polar(body.longitude, WHEEL.marker, ascendant),
        label: { x: chosen.x, y: chosen.y },
        box: chosen,
        displaced: displacement !== 0 || Math.abs(Math.hypot(chosen.x, chosen.y) - 214) > 1,
      });
    }
    return placements;
  }
  function fit(compact: boolean): BodyPlacement[] {
    const first = place(compact);
    if (first.length === bodies.length) return first;
    const retry = place(compact, true);
    const best = retry.length > first.length ? retry : first;
    const indices = new Map(sorted.map((body, i) => [body.id, i]));
    return best.sort((a, b) => indices.get(a.id)! - indices.get(b.id)!);
  }
  const full = fit(false);
  return full.length === bodies.length
    ? { placements: full, compact: false }
    : { placements: fit(true), compact: true };
}

export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
    : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!,
      b = polygon[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Convex hull supplies an unambiguous selectable interior for supplied groups. */
export function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points]
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((point, i, array) => !i || point.x !== array[i - 1]!.x || point.y !== array[i - 1]!.y);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [],
    upper: Point[] = [];
  for (const point of sorted) {
    while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of [...sorted].reverse()) {
    while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
