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
export const WHEEL = {
  outer: 286,
  zodiacInner: 252,
  marker: 239,
  house: 198,
  houseLabel: 184,
  aspect: 140,
  extent: 330,
} as const;

/** Positive zodiac longitude proceeds counterclockwise from the ascendant at left. */
export function polar(longitude: number, radius: number, ascendant = 0): Point {
  const angle = ((180 + longitude - ascendant) * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
export function boxesOverlap(a: Box, b: Box, padding = 3): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + padding &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + padding
  );
}

/** Screen-sized labels, deterministic across input order. Marker positions never move. */
export function layoutBodies(
  bodies: readonly Body[],
  ascendant: number,
  pixelsPerUnit: number,
  measure?: (body: Body) => { width: number; height: number },
  reservedBoxes: readonly Box[] = [],
): BodyPlacement[] {
  const occupied: Box[] = [...reservedBoxes];
  const scale = Math.max(pixelsPerUnit, 0.05);
  return [...bodies]
    .sort(
      (a, b) =>
        normalize(a.longitude - ascendant) - normalize(b.longitude - ascendant) ||
        a.id.localeCompare(b.id),
    )
    .map((body) => {
      const size = measure?.(body) ?? { width: 34, height: 40 };
      const width = size.width / scale,
        height = size.height / scale;
      let chosen: Box | undefined;
      let displacement = 0;
      // Try small angular shifts in the outer lanes before moving labels inward.
      // This leaves room for house numbers without crowding the aspect area.
      const radii = [214, 184, 154, 124, 94, 64, 34];
      for (let step = 0; step <= 180 && !chosen; step++) {
        for (const [lane, radius] of radii.entries()) {
          const angularStep = step - lane * 16;
          if (angularStep < 0) continue;
          const offsets = angularStep === 0 ? [0] : [angularStep * 2, -angularStep * 2];
          for (const offset of offsets) {
            const point = polar(body.longitude + offset, radius, ascendant);
            const box = { ...point, width, height };
            if (!occupied.some((other) => boxesOverlap(box, other, 4 / scale))) {
              chosen = box;
              displacement = offset;
              break;
            }
          }
          if (chosen) break;
        }
      }
      // For pathological data sets, continue into outer lanes rather than overlap.
      if (!chosen) {
        let radius = 320;
        while (!chosen) {
          const point = polar(body.longitude, radius, ascendant);
          const candidate = { ...point, width, height };
          if (!occupied.some((other) => boxesOverlap(candidate, other, 4 / scale)))
            chosen = candidate;
          radius += height + 6 / scale;
        }
      }
      occupied.push(chosen);
      return {
        id: body.id,
        marker: polar(body.longitude, WHEEL.marker, ascendant),
        label: { x: chosen.x, y: chosen.y },
        box: chosen,
        displaced: displacement !== 0 || Math.hypot(chosen.x, chosen.y) < 210,
      };
    });
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
