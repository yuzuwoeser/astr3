import { expect, it } from 'vitest';
import { createModel } from '../../src/model/index.js';
import { boxesOverlap, layoutBodies, polar } from '../../src/layout.js';
import { hitTest } from '../../src/picking.js';
import type { HitTarget } from '../../src/picking.js';

it('keeps tightly clustered glyphs separate at phone and desktop scale without moving markers', () => {
  const model = createModel({
    bodies: Array.from({ length: 15 }, (_, i) => ({
      id: `body${i}`,
      name: `Body ${i}`,
      longitude: (359 + i / 5) % 360,
    })),
  });
  for (const scale of [0.5, 1.2]) {
    const placements = layoutBodies(model.bodies, 10, scale);
    for (const [i, a] of placements.entries()) {
      expect(a.marker).toEqual(polar(model.bodies.find((b) => b.id === a.id)!.longitude, 239, 10));
      for (const b of placements.slice(i + 1))
        expect(boxesOverlap(a.box, b.box, 3 / scale)).toBe(false);
    }
    expect(layoutBodies([...model.bodies].reverse(), 10, scale)).toEqual(placements);
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
  const placements = layoutBodies(
    model.bodies,
    0,
    0.5,
    () => ({ width: 42, height: 44 }),
    reserved,
  );
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
