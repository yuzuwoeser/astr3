import { expect, it } from 'vitest';
import { createModel } from '../../src/model/index.js';
import { WHEEL, aspectPath, boxesOverlap, layoutBodies, polar } from '../../src/layout.js';
import type { BodyPlacement, Point } from '../../src/layout.js';
import { syntheticNatal } from '../fixtures/synthetic-chart.js';
import { hitTest } from '../../src/picking.js';
import type { HitTarget } from '../../src/picking.js';

function expectWithinBand(placements: BodyPlacement[], scale: number) {
  for (const { box } of placements) {
    // The inner check uses the nearest point on the rectangle, which can be
    // midway along an edge. Checking only its corners would miss crossings.
    const near = Math.hypot(
      Math.max(0, Math.abs(box.x) - box.width / 2),
      Math.max(0, Math.abs(box.y) - box.height / 2),
    );
    const far = Math.hypot(Math.abs(box.x) + box.width / 2, Math.abs(box.y) + box.height / 2);
    expect(near).toBeGreaterThanOrEqual(WHEEL.house + 4 / scale - 1e-6);
    expect(far).toBeLessThanOrEqual(WHEEL.labelOuter - 4 / scale + 1e-6);
  }
}

it('keeps tightly clustered glyphs separate at phone and desktop scale without moving markers', () => {
  const model = createModel({
    bodies: Array.from({ length: 15 }, (_, i) => ({
      id: `body${i}`,
      name: `Body ${i}`,
      longitude: (359 + i / 5) % 360,
    })),
  });
  for (const scale of [0.5, 1.2]) {
    const layout = layoutBodies(model.bodies, 10, scale);
    const { placements } = layout;
    expect(placements).toHaveLength(model.bodies.length);
    expectWithinBand(placements, scale);
    for (const [i, a] of placements.entries()) {
      expect(a.marker).toEqual(polar(model.bodies.find((b) => b.id === a.id)!.longitude, 239, 10));
      for (const b of placements.slice(i + 1))
        expect(boxesOverlap(a.box, b.box, 3 / scale)).toBe(false);
    }
    expect(layoutBodies([...model.bodies].reverse(), 10, scale)).toEqual(layout);
  }
});

it('prioritizes labels, provides screen-pixel line tolerance, and offers overlapping candidates', () => {
  const targets: HitTarget[] = [
    {
      selection: { kind: 'aspect', id: 'one' },
      priority: 1,
      shape: 'line',
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
    },
    {
      selection: { kind: 'aspect', id: 'two' },
      priority: 1,
      shape: 'line',
      a: { x: 0, y: 2 },
      b: { x: 100, y: 2 },
    },
    {
      selection: { kind: 'group', id: 'group' },
      priority: 2,
      shape: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ],
    },
    {
      selection: { kind: 'body', id: 'body' },
      priority: 0,
      shape: 'box',
      box: { x: 50, y: 0, width: 10, height: 10 },
    },
  ];
  expect(hitTest(targets, { x: 50, y: 0 })).toEqual([{ kind: 'body', id: 'body' }]);
  expect(hitTest(targets, { x: 30, y: 1 })).toHaveLength(2);
  expect(hitTest(targets.slice(0, 1), { x: 30, y: 9 })).toEqual([]);
  expect(hitTest(targets.slice(0, 1), { x: 30, y: 14 }, true)).toHaveLength(1);
  expect(hitTest(targets, { x: 50, y: 50 })).toEqual([{ kind: 'group', id: 'group' }]);
});

it('reserves house-label space without moving markers or mutating the reserved boxes', () => {
  const model = createModel({
    bodies: Array.from({ length: 8 }, (_, i) => ({
      id: `body${i}`,
      name: `Body ${i}`,
      longitude: i / 4,
    })),
  });
  const reserved = [{ x: -184, y: 0, width: 24, height: 24 }];
  const original = structuredClone(reserved);
  const { placements } = layoutBodies(
    model.bodies,
    0,
    0.5,
    (_body, compact) => (compact ? { width: 26, height: 28 } : { width: 42, height: 44 }),
    reserved,
  );
  expect(placements).toHaveLength(model.bodies.length);
  expectWithinBand(placements, 0.5);
  for (const [i, placement] of placements.entries()) {
    expect(placement.marker).toEqual(
      polar(model.bodies.find((body) => body.id === placement.id)!.longitude, 239),
    );
    expect(boxesOverlap(placement.box, reserved[0]!, 3 / 0.5)).toBe(false);
    for (const other of placements.slice(i + 1))
      expect(boxesOverlap(placement.box, other.box, 3 / 0.5)).toBe(false);
  }
  expect(reserved).toEqual(original);
});

it('keeps synthetic clustered bodies outside the house circle without changing their positions', () => {
  const data = syntheticNatal;
  const model = createModel(data);
  const ascendant = model.angles.ascendant!;
  const original = structuredClone(model);
  for (const scale of [0.52, 0.57, 1.2, 1.8]) {
    const { placements } = layoutBodies(model.bodies, ascendant, scale);
    expect(placements).toHaveLength(14);
    expectWithinBand(placements, scale);
    for (const placement of placements)
      expect(placement.marker).toEqual(
        polar(
          model.bodies.find((body) => body.id === placement.id)!.longitude,
          WHEEL.marker,
          ascendant,
        ),
      );
  }
  expect(model).toEqual(original);
});

it('uses measured compact labels when necessary and restores full labels when space returns', () => {
  const model = createModel({ bodies: [{ id: 'mercury', name: 'Mercury', longitude: 45 }] });
  const measure = (_body: unknown, compact: boolean) =>
    compact ? { width: 22, height: 27 } : { width: 44, height: 48 };
  // Full-only probes let the renderer try smaller fonts before compacting.
  const probe = layoutBodies(model.bodies, 0, 0.5, measure, [], undefined, 'full');
  expect(probe).toEqual({ placements: [], compact: false });
  const smaller = layoutBodies(
    model.bodies,
    0,
    0.5,
    () => ({ width: 34, height: 32 }),
    [],
    undefined,
    'full',
  );
  expect(smaller.compact).toBe(false);
  expect(smaller.placements).toHaveLength(1);
  expectWithinBand(smaller.placements, 0.5);
  const compact = layoutBodies(model.bodies, 0, 0.5, measure);
  expect(compact.compact).toBe(true);
  expect(compact.placements).toHaveLength(1);
  expectWithinBand(compact.placements, 0.5);
  const full = layoutBodies(model.bodies, 0, 1.5, measure);
  expect(full.compact).toBe(false);
  expect(full.placements).toHaveLength(1);
  expectWithinBand(full.placements, 1.5);
  expect(compact.placements[0]!.marker).toEqual(full.placements[0]!.marker);
});

it('omits unplaceable labels instead of using the house disk or unbounded outer lanes', () => {
  const model = createModel({
    bodies: [{ id: 'point', name: 'Very wide point', longitude: 60 }],
  });
  const layout = layoutBodies(model.bodies, 0, 0.5, () => ({ width: 1000, height: 1000 }));
  expect(layout).toEqual({ compact: true, placements: [] });
  expect(layoutBodies(model.bodies, 0, 0.05).placements).toEqual([]);
});

const conjunctionOptions = {
  type: 'conjunction' as const,
  markerRadii: [2.5, 2.5] as const,
  ringRadius: WHEEL.house,
};
function ringPair(distancePx: number, scale = 1): [Point, Point] {
  const half = distancePx / scale / 2;
  const x = -Math.sqrt(WHEEL.house ** 2 - half ** 2);
  return [
    { x, y: -half },
    { x, y: half },
  ];
}

it('keeps non-conjunction connectors straight regardless of screen distance', () => {
  for (const type of ['sextile', 'square', 'trine', 'opposition'] as const)
    for (const distance of [0, 0.1, 6, 48]) {
      const [start, end] = ringPair(distance);
      expect(aspectPath(start, end, 1, { ...conjunctionOptions, type })).toEqual({
        points: [start, end],
        opacity: 1,
      });
    }
});

it('suppresses overlapping conjunctions using CSS-pixel marker extents and clearance', () => {
  for (const scale of [0.5, 1, 2]) {
    for (const distance of [0, 0.1, 6, 7])
      expect(aspectPath(...ringPair(distance, scale), scale, conjunctionOptions)).toEqual({
        points: [],
        opacity: 0,
      });
    expect(
      aspectPath(...ringPair(8, scale), scale, conjunctionOptions).points.length,
    ).toBeGreaterThan(0);
    // Heavier markers and outlined transit diamonds occupy more screen space.
    expect(
      aspectPath(...ringPair(8, scale), scale, {
        ...conjunctionOptions,
        markerRadii: [3.5, 3.5],
      }).points,
    ).toEqual([]);
    expect(
      aspectPath(...ringPair(8, scale), scale, {
        ...conjunctionOptions,
        markerRadii: [2.5, 4],
      }).points,
    ).toEqual([]);
  }
  const [start, end] = ringPair(20);
  expect(aspectPath(start, end, 0.3, conjunctionOptions).points).toEqual([]);
  expect(aspectPath(start, end, 1, conjunctionOptions).opacity).toBe(1);
});

it('makes bow depth inversely proportional to spacing and keeps curves inside the ring', () => {
  for (const scale of [0.2, 0.5, 1.2, 2]) {
    const depths = [12, 24, 48].map((distance) => {
      const [start, end] = ringPair(distance, scale);
      const path = aspectPath(start, end, scale, conjunctionOptions);
      expect(path.opacity).toBe(1);
      expect(path.points).toHaveLength(17);
      expect(path.points[0]).toEqual(start);
      expect(path.points.at(-1)).toEqual(end);
      for (const point of path.points)
        expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(WHEEL.house + 1e-8);
      const middle = path.points[8]!;
      const depth = Math.hypot(middle.x - (start.x + end.x) / 2, middle.y) * scale;
      expect(depth).toBeGreaterThan(0);
      expect(depth).toBeLessThanOrEqual(Math.min(20, (WHEEL.house * scale) / 4));
      return depth;
    });
    expect(depths[0]! / depths[1]!).toBeCloseTo(2, 10);
    expect(depths[1]! / depths[2]!).toBeCloseTo(2, 10);
  }
});

it('fades conjunctions smoothly across four CSS pixels after the overlap threshold', () => {
  for (const scale of [0.5, 1, 2]) {
    for (const [distance, opacity] of [
      [7, 0],
      [8, 0.15625],
      [9, 0.5],
      [10, 0.84375],
      [11, 1],
      [24, 1],
    ] as const)
      expect(
        aspectPath(...ringPair(distance, scale), scale, conjunctionOptions).opacity,
      ).toBeCloseTo(opacity, 10);
    expect(aspectPath(...ringPair(7.0001, scale), scale, conjunctionOptions).opacity).toBeLessThan(
      1e-8,
    );
  }
});

it('generates the same bow after reversal, rotation, wraparound, and repeated calls', () => {
  const [start, end] = ringPair(18);
  const path = aspectPath(start, end, 1, conjunctionOptions);
  expect(aspectPath(start, end, 1, conjunctionOptions)).toEqual(path);
  const reversed = aspectPath(end, start, 1, conjunctionOptions).points.reverse();
  for (const [i, point] of path.points.entries()) {
    expect(reversed[i]!.x).toBeCloseTo(point.x, 10);
    expect(reversed[i]!.y).toBeCloseTo(point.y, 10);
  }
  for (const angle of [0.0001, Math.PI / 2, Math.PI * 2 - 0.0001]) {
    const rotate = (point: Point) => ({
      x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
      y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
    });
    const rotated = aspectPath(rotate(start), rotate(end), 1, conjunctionOptions);
    expect(rotated.opacity).toBe(path.opacity);
    for (const [i, point] of path.points.map(rotate).entries()) {
      expect(rotated.points[i]!.x).toBeCloseTo(point.x, 10);
      expect(rotated.points[i]!.y).toBeCloseTo(point.y, 10);
    }
  }
});

it('uses a finite straight fallback when a supplied conjunction has antipodal endpoints', () => {
  const start = polar(0, WHEEL.house),
    end = polar(180, WHEEL.house);
  expect(aspectPath(start, end, 1, conjunctionOptions)).toEqual({
    points: [start, end],
    opacity: 1,
  });
});
