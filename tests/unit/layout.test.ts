import { expect, it } from 'vitest';
import { createModel } from '../../src/model/index.js';
import { WHEEL, aspectPath, boxesOverlap, layoutBodies, polar } from '../../src/layout.js';
import type { BodyPlacement } from '../../src/layout.js';
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
    expect(placements).toHaveLength(10);
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

it('joins exact ring anchors for ordinary aspects and visible conjunction loops', () => {
  const start = polar(0, WHEEL.house);
  const end = polar(120, WHEEL.house);
  expect(aspectPath(start, end, 1)).toEqual([start, end]);
  for (const scale of [0.5, 1.2]) {
    for (const longitude of [0, 0.1, 359.9]) {
      const close = polar(longitude, WHEEL.house);
      const path = aspectPath(start, close, scale);
      expect(path[0]).toEqual(start);
      expect(path.at(-1)).toEqual(close);
      const middle = path[Math.floor(path.length / 2)]!;
      expect(Math.hypot(middle.x - start.x, middle.y - start.y) * scale).toBeGreaterThan(14);
      for (const point of path)
        expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(WHEEL.house + 1e-8);
    }
  }
});
