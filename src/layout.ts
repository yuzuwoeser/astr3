import { normalize, signedDistance } from './model/math.js';
import { packLabels } from './label-packing.js';
import type { AspectType, Body } from './model/types.js';

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
export interface BodyCluster {
  id: string;
  bodyIds: string[];
  label: Point;
  box: Box;
}
export interface BodyLayout {
  placements: BodyPlacement[];
  clusters: BodyCluster[];
  compact: boolean;
}
export const WHEEL = {
  outer: 286,
  zodiacInner: 252,
  marker: 252,
  labelOuter: 242,
  house: 148,
  houseOuter: 237,
  houseLabel: 133,
  extent: 330,
} as const;

/** Positive zodiac longitude proceeds counterclockwise from the ascendant at left. */
export function polar(longitude: number, radius: number, ascendant = 0): Point {
  const angle = ((180 + longitude - ascendant) * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Marker radii are CSS pixels; anchors and ringRadius are wheel coordinates. */
export function aspectPath(
  start: Point,
  end: Point,
  pixelsPerUnit: number,
  {
    type,
    markerRadii,
    ringRadius,
  }: {
    type: AspectType;
    markerRadii: readonly [number, number];
    ringRadius: number;
  },
): { points: Point[]; opacity: number } {
  if (type !== 'conjunction') return { points: [start, end], opacity: 1 };
  const scale = Math.max(pixelsPerUnit, 0.05);
  const distance = Math.hypot(end.x - start.x, end.y - start.y) * scale;
  const overlap = markerRadii[0] + markerRadii[1] + 2;
  if (distance <= overlap) return { points: [], opacity: 0 };
  const fade = Math.min(1, (distance - overlap) / 4);
  const opacity = fade * fade * (3 - 2 * fade);
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const radius = Math.hypot(middle.x, middle.y);
  if (radius <= 1e-9) return { points: [start, end], opacity };
  const depth = (Math.min(20, (ringRadius * scale) / 4) * overlap) / distance / scale;
  // A quadratic's midpoint lies halfway between the chord midpoint and its
  // control point. Keep the inward direction tied to the wheel, not the camera.
  const control = {
    x: middle.x - (middle.x / radius) * 2 * depth,
    y: middle.y - (middle.y / radius) * 2 * depth,
  };
  return {
    opacity,
    points: Array.from({ length: 17 }, (_, i) => {
      if (i === 0) return start;
      if (i === 16) return end;
      const t = i / 16,
        u = 1 - t;
      return {
        x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      };
    }),
  };
}
export function boxesOverlap(a: Box, b: Box, padding = 3): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + padding &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + padding
  );
}

/** Screen-sized labels use collective local packing. Exact longitude markers never move. */
export function layoutBodies(
  bodies: readonly Body[],
  ascendant: number,
  pixelsPerUnit: number,
  measure: (body: Body, compact: boolean) => { width: number; height: number } = (
    _body,
    compact,
  ) => ({ width: compact ? 26 : 34, height: compact ? 28 : 40 }),
  reservedBoxes: readonly Box[] = [],
  band: { inner: number; outer: number; marker: number; preferred: number } = {
    inner: WHEEL.house,
    outer: WHEEL.labelOuter,
    marker: WHEEL.marker,
    preferred: 214,
  },
  mode: 'auto' | 'full' | 'compact' = 'auto',
  measureCluster?: (count: number) => { width: number; height: number },
): BodyLayout {
  const scale = Math.max(pixelsPerUnit, 0.05),
    padding = 4 / scale;
  const sorted = [...bodies].sort(
    (a, b) =>
      normalize(a.longitude - ascendant) - normalize(b.longitude - ascendant) ||
      a.id.localeCompare(b.id),
  );
  type Item = {
    id: string;
    angle: number;
    width: number;
    height: number;
    limit: number;
    members: Body[];
    clustered: boolean;
  };
  function fit(compact: boolean, cluster = false): BodyLayout {
    let items: Item[] = sorted.map((body) => {
      const size = measure(body, compact);
      return {
        id: `body:${body.id}`,
        angle: normalize(body.longitude - ascendant),
        width: size.width / scale,
        height: size.height / scale,
        limit: 30,
        members: [body],
        clustered: false,
      };
    });
    // Each replacement merges a conflicting neighborhood or removes one
    // unplaceable badge. The budget guarantees termination even at tiny scales.
    for (let pass = 0; pass <= bodies.length * 2; pass++) {
      const result = packLabels(items, band, padding, reservedBoxes);
      if (result.placements) {
        const placements: BodyPlacement[] = [],
          clusters: BodyCluster[] = [];
        for (const placement of result.placements) {
          const item = items.find((item) => item.id === placement.id)!;
          const label = { x: placement.box.x, y: placement.box.y };
          if (item.clustered)
            clusters.push({
              id: item.id,
              bodyIds: item.members.map((body) => body.id),
              label,
              box: placement.box,
            });
          else
            placements.push({
              id: item.members[0]!.id,
              marker: polar(item.members[0]!.longitude, band.marker, ascendant),
              label,
              box: placement.box,
              displaced:
                Math.abs(signedDistance(placement.angle, item.angle)) > 1e-6 ||
                Math.abs(placement.radius - band.preferred) > 1,
            });
        }
        return { placements, clusters, compact };
      }
      if (!cluster || !measureCluster || !items.length) break;
      const failing = items.filter((item) => result.conflict.includes(item.id));
      let candidates = failing.length ? failing : items;
      function combine(group: Item[]): Item | undefined {
        const members = group
          .flatMap((item) => item.members)
          .sort(
            (a, b) =>
              normalize(a.longitude - ascendant) - normalize(b.longitude - ascendant) ||
              a.id.localeCompare(b.id),
          );
        const angles = members.map((body) => normalize(body.longitude - ascendant));
        let start = 0,
          largestGap = -1;
        for (let i = 0; i < angles.length; i++) {
          const next = i === angles.length - 1 ? angles[0]! + 360 : angles[i + 1]!;
          if (next - angles[i]! > largestGap) {
            largestGap = next - angles[i]!;
            start = (i + 1) % angles.length;
          }
        }
        const span = angles.length === 1 ? 0 : 360 - largestGap;
        if (span > 60 + 1e-6) return;
        const ordered = [...members.slice(start), ...members.slice(0, start)];
        const size = measureCluster!(members.length);
        return {
          id: `cluster:${JSON.stringify(ordered.map((body) => body.id))}`,
          angle: normalize(angles[start]! + span / 2),
          width: size.width / scale,
          height: size.height / scale,
          limit: Math.max(0, 30 - span / 2),
          members: ordered,
          clustered: true,
        };
      }
      let combined = combine(candidates);
      if (!combined || (candidates.length === 1 && candidates[0]!.clustered)) {
        let pair: Item[] | undefined,
          closest = Infinity;
        for (const first of candidates)
          for (const second of items) {
            if (first === second) continue;
            const merged = combine([first, second]);
            const distance = merged ? 30 - merged.limit : Infinity;
            if (distance < closest) {
              closest = distance;
              pair = [first, second];
              combined = merged;
            }
          }
        if (pair) candidates = pair;
        else {
          items = items.filter((item) => item !== candidates[0]);
          continue;
        }
      }
      // Collapse the whole local collision neighborhood, not just the last
      // symbols in a minimal infeasible constraint chain.
      for (const other of items) {
        if (candidates.includes(other)) continue;
        const nearby = candidates.some((item) => {
          const half = (value: Item) =>
            (Math.asin(
              Math.min(
                1,
                (Math.hypot(value.width, value.height) / 2 + padding / 2) / band.preferred,
              ),
            ) *
              180) /
            Math.PI;
          return Math.abs(signedDistance(item.angle, other.angle)) <= half(item) + half(other);
        });
        const expanded = nearby ? combine([...candidates, other]) : undefined;
        if (expanded) {
          candidates.push(other);
          combined = expanded;
        }
      }
      const ids = new Set(candidates.map((item) => item.id));
      items = [...items.filter((item) => !ids.has(item.id)), combined!];
    }
    return { placements: [], clusters: [], compact };
  }
  if (mode === 'compact') return fit(true, !!measureCluster);
  const full = fit(false);
  return mode === 'full' || full.placements.length === bodies.length
    ? full
    : fit(true, !!measureCluster);
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
