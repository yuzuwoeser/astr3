import { describe, expect, it } from 'vitest';
import {
  calculateAspects,
  createModel,
  formatPosition,
  getSelectionDetails,
} from '../../src/model/index.js';
import type { ChartInput } from '../../src/model/index.js';

const bodies = [
  { id: 'a', name: 'A', longitude: 359 },
  { id: 'b', name: 'B', longitude: 1 },
  { id: 'c', name: 'C', longitude: 119 },
];
const houses = Array.from({ length: 12 }, (_, i) => ({
  id: `h${i + 1}`,
  number: i + 1,
  longitude: (350 + i * 30) % 360,
}));

describe('chart model', () => {
  it('computes wraparound aspects and inclusive orb boundaries', () => {
    const aspects = calculateAspects(bodies, { conjunction: 2, trine: 2 });
    expect(aspects.find((a) => a.bodyIds[0] === 'a' && a.bodyIds[1] === 'b')).toMatchObject({
      type: 'conjunction',
      separation: 2,
      orb: 2,
    });
    expect(aspects.find((a) => a.bodyIds[0] === 'a' && a.bodyIds[1] === 'c')).toMatchObject({
      type: 'trine',
      orb: 0,
    });
    expect(calculateAspects(bodies.slice(0, 2), { conjunction: 1.999 })).toHaveLength(0);
  });
  it('respects supplied aspect lists and derives their true orbs', () => {
    expect(createModel({ bodies, aspects: [] }).aspects).toEqual([]);
    expect(
      createModel({ bodies, aspects: [{ id: 'custom', type: 'trine', bodyIds: ['a', 'c'] }] })
        .aspects[0],
    ).toMatchObject({ orb: 0, angle: 120, separation: 120 });
  });
  it('assigns houses by actual cusps including wraparound and cusp boundaries', () => {
    const model = createModel({
      bodies: [...bodies, { id: 'boundary', name: 'Boundary', longitude: 20 }],
      houses,
    });
    expect(model.bodies.map((b) => b.house)).toEqual([1, 1, 5, 2]);
    expect(model.houses[0]?.bodyIds).toEqual(['a', 'b']);
  });
  it('handles unknown houses without fabricating them and carries uncertainty', () => {
    expect(createModel({ bodies, timeUncertain: true })).toMatchObject({
      houses: [],
      angles: {},
      houseStatus: 'unknown',
      timeUncertain: true,
    });
  });

  it('clears derived house membership when a normalized chart is reused without houses', () => {
    const original = createModel({ bodies, houses });
    const updated = createModel({ ...original, houses: [], houseStatus: 'unknown' });
    expect(updated.bodies.every((body) => body.house === undefined)).toBe(true);
  });
  it('returns complete relationships for a body, aspect, house, and supplied group', () => {
    const model = createModel({
      bodies,
      houses,
      aspects: [
        { id: 'ab', type: 'conjunction', bodyIds: ['a', 'b'] },
        { id: 'ac', type: 'trine', bodyIds: ['a', 'c'] },
      ],
      groups: [{ id: 'group', name: 'Configuration', bodyIds: ['a'], aspectIds: ['ac'] }],
    });
    expect(getSelectionDetails(model, { kind: 'body', id: 'a' })?.aspects).toHaveLength(2);
    expect(
      getSelectionDetails(model, { kind: 'aspect', id: 'ab' })?.bodies.map((b) => b.id),
    ).toEqual(['a', 'b']);
    expect(
      getSelectionDetails(model, { kind: 'house', id: 'h1' })?.bodies.map((b) => b.id),
    ).toEqual(['a', 'b']);
    expect(
      getSelectionDetails(model, { kind: 'group', id: 'group' })?.bodies.map((b) => b.id),
    ).toEqual(['a', 'c']);
    expect(getSelectionDetails(model, { kind: 'body', id: 'absent' })).toBeNull();
  });
  it.each([
    [{ bodies: [...bodies, bodies[0]!] }, 'Duplicate ID'],
    [{ bodies: [{ id: 'nan', name: 'NaN', longitude: NaN }] }, 'finite'],
    [{ bodies, houses: houses.slice(0, 11) }, 'twelve'],
    [{ bodies, houses: houses.map((h) => ({ ...h, longitude: 0 })) }, 'advance'],
    [
      { bodies, aspects: [{ id: 'broken', type: 'trine', bodyIds: ['a', 'missing'] }] },
      'missing body',
    ],
    [
      { bodies, groups: [{ id: 'broken', name: 'Broken', bodyIds: [], aspectIds: ['missing'] }] },
      'missing aspect',
    ],
    [{ bodies, houseStatus: 'available' }, 'requires twelve'],
  ])('rejects malformed charts with actionable errors', (input, message) => {
    expect(() => createModel(input as ChartInput)).toThrow(message);
  });
  it('normalizes without modifying or freezing caller data', () => {
    const input = { bodies: [{ id: 'a', name: 'A', longitude: -1, speed: -0.2 }] };
    const model = createModel(input);
    expect(model.bodies[0]).toMatchObject({ longitude: 359, retrograde: true, sign: 'Pisces' });
    expect(Object.isFrozen(model.bodies[0])).toBe(true);
    expect(Object.isFrozen(input.bodies[0])).toBe(false);
    expect(input.bodies[0]?.longitude).toBe(-1);
  });
  it('uses stable calculated aspect IDs if body order changes', () => {
    expect(
      calculateAspects(bodies)
        .map((a) => a.id)
        .sort(),
    ).toEqual(
      calculateAspects([...bodies].reverse())
        .map((a) => a.id)
        .sort(),
    );
  });
  it('carries degree/minute rounding across sign boundaries', () => {
    expect(formatPosition(29.9999)).toBe('0°00′ Taurus');
    expect(formatPosition(359.9999)).toBe('0°00′ Aries');
  });
});
