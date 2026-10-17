import { distanceToSegment, pointInPolygon } from './layout.js';
import type { Box, Point } from './layout.js';
import type { Selection } from './model/types.js';
import { selectionKey } from './model/model.js';

export type HitTarget =
  | { selection: Selection; priority: number; shape: 'box'; box: Box }
  | { selection: Selection; priority: number; shape: 'line'; a: Point; b: Point }
  | { selection: Selection; priority: number; shape: 'polygon'; points: readonly Point[] }
  | { selection: Selection; priority: number; shape: 'circle'; center: Point; radius: number };

/** CSS-pixel targets retain the same tolerance at any device pixel ratio or zoom. */
export function hitTest(targets: readonly HitTarget[], point: Point, touch = false): Selection[] {
  const tolerance = touch ? 14 : 8;
  const hits = targets
    .flatMap((target) => {
      let hit = false,
        distance = 0;
      if (target.shape === 'box') {
        const dx = Math.max(0, Math.abs(point.x - target.box.x) - target.box.width / 2);
        const dy = Math.max(0, Math.abs(point.y - target.box.y) - target.box.height / 2);
        distance = Math.hypot(dx, dy);
        hit = distance <= (touch ? 6 : 0);
      } else if (target.shape === 'line') {
        distance = distanceToSegment(point, target.a, target.b);
        hit = distance <= tolerance;
      } else if (target.shape === 'circle') {
        distance = Math.hypot(point.x - target.center.x, point.y - target.center.y);
        hit = distance <= target.radius + (touch ? 6 : 0);
      } else hit = pointInPolygon(point, target.points);
      return hit ? [{ target, distance }] : [];
    })
    .sort(
      (a, b) =>
        a.target.priority - b.target.priority ||
        a.distance - b.distance ||
        selectionKey(a.target.selection).localeCompare(selectionKey(b.target.selection)),
    );
  const priority = hits[0]?.target.priority;
  const seen = new Set<string>();
  return hits
    .filter((hit) => hit.target.priority === priority)
    .map((hit) => hit.target.selection)
    .filter((selection) => {
      const key = selectionKey(selection);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
