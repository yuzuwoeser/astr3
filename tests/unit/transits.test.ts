import { describe, expect, it } from 'vitest';
import {
  createTransitModel,
  getTransitSelectionDetails,
  transitSelectionKey,
  DEFAULT_ORBS,
} from '../../src/model/index.js';
import type { TransitChartInput } from '../../src/model/index.js';
import { createAstronomyProvider } from '../../src/ephemeris/index.js';
import { stepTransitTime } from '../../demo/transit-time.js';

const input: TransitChartInput = {
  natal: {
    bodies: [
      { id: 'mars', name: 'Mars', longitude: 359 },
      { id: 'sun', name: 'Sun', longitude: 119 },
    ],
    houses: Array.from({ length: 12 }, (_, i) => ({
      id: `h${i + 1}`,
      number: i + 1,
      longitude: i * 30,
    })),
  },
  transit: {
    bodies: [
      { id: 'mars', name: 'Mars', longitude: 1, speed: -1 },
      { id: 'sun', name: 'Sun', longitude: 93 },
    ],
  },
};
describe('transit model', () => {
  it('keeps repeated IDs separate, derives all three families and uses natal houses', () => {
    const model = createTransitModel(input);
    expect(model.natal.bodies[0]).toMatchObject({ id: 'mars', longitude: 359, house: 12 });
    expect(model.transit.bodies[0]).toMatchObject({
      id: 'mars',
      longitude: 1,
      natalHouse: 1,
      house: undefined,
      retrograde: true,
    });
    expect(
      model.crossAspects.find((aspect) => aspect.bodyRefs.every((ref) => ref.id === 'mars')),
    ).toMatchObject({ type: 'conjunction', orb: 2 });
    expect(model.natal.aspects.length).toBeGreaterThan(0);
    expect(model.transit.aspects.length).toBeGreaterThan(0);
    expect(Object.isFrozen(model.transit.bodies[0])).toBe(true);
    expect(input.transit.bodies[0]).not.toHaveProperty('natalHouse');
    expect(transitSelectionKey({ kind: 'body', chart: 'natal', id: 'mars' })).not.toBe(
      transitSelectionKey({ kind: 'body', chart: 'transit', id: 'mars' }),
    );
  });
  it('patches families independently, includes boundaries, and keeps supplied aspects authoritative', () => {
    const exact = createTransitModel(input, { orbs: { cross: { conjunction: 2 } } });
    const tight = createTransitModel(input, { orbs: { cross: { conjunction: 1.99 } } });
    expect(exact.crossAspects.some((aspect) => aspect.type === 'conjunction')).toBe(true);
    expect(tight.crossAspects.some((aspect) => aspect.type === 'conjunction')).toBe(false);
    expect(tight.natal.aspects).toEqual(exact.natal.aspects);
    expect(tight.transit.aspects).toEqual(exact.transit.aspects);
    expect(createTransitModel({ ...input, crossAspects: [] }).crossAspects).toEqual([]);
    const custom = {
      id: 'outside',
      type: 'opposition' as const,
      bodyRefs: [
        { chart: 'natal' as const, id: 'mars' },
        { chart: 'transit' as const, id: 'mars' },
      ] as const,
    };
    expect(
      createTransitModel(
        { ...input, crossAspects: [custom] },
        { orbs: { cross: { opposition: 0 } } },
      ).crossAspects[0],
    ).toMatchObject({ orb: 178 });
    expect(createTransitModel(input).crossAspects).toEqual(
      createTransitModel(input, {
        orbs: { natal: DEFAULT_ORBS, cross: DEFAULT_ORBS, transit: DEFAULT_ORBS },
      }).crossAspects,
    );
  });
  it('exposes source-qualified relationships and both sets of natal-house occupants', () => {
    const model = createTransitModel(input);
    const details = getTransitSelectionDetails(model, {
      kind: 'body',
      chart: 'transit',
      id: 'mars',
    })!;
    expect(details.object).toMatchObject({ chart: 'transit', id: 'mars', natalHouse: 1 });
    expect(details.bodies.some((body) => body.chart === 'natal' && body.id === 'mars')).toBe(true);
    const house = getTransitSelectionDetails(model, { kind: 'house', chart: 'natal', id: 'h1' })!;
    expect(house.bodies).toHaveLength(1);
    expect(house.bodies[0]).toMatchObject({ chart: 'transit', id: 'mars' });
    expect(
      // @ts-expect-error Cross is an aspect family, not a planet source.
      getTransitSelectionDetails(model, { kind: 'body', chart: 'cross', id: 'mars' }),
    ).toBeNull();
  });
  it('ignores transit cusps, does not invent unknown natal houses, and keeps scoped groups', () => {
    const data = {
      natal: { bodies: input.natal.bodies },
      transit: {
        ...input.transit,
        houses: input.natal.houses,
        groups: [{ id: 'g', name: 'Pair', bodyIds: ['mars', 'sun'], aspectIds: [] }],
      },
    };
    const model = createTransitModel(data);
    expect(model.transit.houses).toEqual([]);
    expect(model.transit.bodies.every((body) => body.natalHouse === undefined)).toBe(true);
    expect(
      getTransitSelectionDetails(model, { kind: 'group', chart: 'transit', id: 'g' })!.bodies.map(
        (body) => body.chart,
      ),
    ).toEqual(['transit', 'transit']);
  });
  it('rejects invalid references, duplicate cross IDs, and invalid orb limits', () => {
    const aspect = {
      id: 'a',
      type: 'trine' as const,
      bodyRefs: [
        { chart: 'natal' as const, id: 'mars' },
        { chart: 'transit' as const, id: 'missing' },
      ] as const,
    };
    expect(() => createTransitModel({ ...input, crossAspects: [aspect] })).toThrow('existing');
    const valid = {
      ...aspect,
      bodyRefs: [
        { chart: 'natal' as const, id: 'mars' },
        { chart: 'transit' as const, id: 'mars' },
      ] as const,
    };
    expect(() => createTransitModel({ ...input, crossAspects: [valid, valid] })).toThrow('unique');
    expect(() => createTransitModel(input, { orbs: { cross: { trine: NaN } } })).toThrow('Orb');
  });
});

describe('transit calculation and UTC stepping', () => {
  it('calculates the same geocentric positions without houses, coordinates, or an uncertainty warning', async () => {
    const provider = createAstronomyProvider();
    const request = { utc: '2000-01-01T12:00:00Z', latitude: 51.5074, longitude: -0.1278 };
    const natal = await provider.calculate(request),
      transit = await provider.calculateTransits({ utc: request.utc });
    expect(transit.bodies).toEqual(
      natal.bodies.filter((body) => !['ascendant', 'midheaven'].includes(body.id)),
    );
    expect(transit.bodies).toHaveLength(12);
    expect(natal.bodies).toHaveLength(14);
    expect(transit.angles).toBeUndefined();
    const model = createTransitModel({ natal, transit });
    for (const id of ['ascendant', 'midheaven'])
      expect(model.crossAspects.some((aspect) => aspect.bodyRefs[0].id === id)).toBe(true);
    const node = getTransitSelectionDetails(model, {
      kind: 'body',
      chart: 'transit',
      id: 'north-node',
    })!;
    expect(node.object).toMatchObject({ natalHouse: expect.any(Number) });
    expect(node.aspects.some((aspect) => aspect.chart === 'cross')).toBe(true);
    expect(transit.houses).toBeUndefined();
    expect(transit.timeUncertain).toBeUndefined();
    expect(transit.metadata?.utc).toBe(request.utc.replace('Z', '.000Z'));
    await expect(provider.calculateTransits({ utc: '2024-01-01T12:00' })).rejects.toThrow('offset');
    await expect(provider.calculateTransits({ utc: '2101-01-01T00:00Z' })).rejects.toThrow('2100');
    const controller = new AbortController();
    const pending = provider.calculateTransits({ utc: request.utc }, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
  });
  it('steps UTC across leap days, month ends and date boundaries', () => {
    expect(stepTransitTime('2024-01-31T12:15Z', 'month', 1)).toBe('2024-02-29T12:15:00.000Z');
    expect(stepTransitTime('2023-03-31T12:15Z', 'month', -1)).toBe('2023-02-28T12:15:00.000Z');
    expect(stepTransitTime('2024-02-28T12:15Z', 'day', 1)).toBe('2024-02-29T12:15:00.000Z');
    expect(stepTransitTime('2024-12-31T23:15Z', 'hour', 1)).toBe('2025-01-01T00:15:00.000Z');
    expect(stepTransitTime('2024-01-01T12:15Z', 'week', -1)).toBe('2023-12-25T12:15:00.000Z');
    expect(() => stepTransitTime('1900-01-01T00:00Z', 'day', -1)).toThrow('1900');
    expect(() => stepTransitTime('2100-12-31T23:00Z', 'hour', 1)).toThrow('2100');
  });
});
