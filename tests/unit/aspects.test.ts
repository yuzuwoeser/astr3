import { describe, expect, it } from 'vitest';
import {
  ASPECT_DEFINITIONS,
  DEFAULT_ENABLED_ASPECTS,
  calculateAspects,
  createModel,
  createTransitModel,
  getSelectionDetails,
  getTransitSelectionDetails,
} from '../../src/model/index.js';
import type {
  AspectEnabledConfig,
  AspectType,
  ChartInput,
  ModelOptions,
} from '../../src/model/index.js';

const minorAspects: [AspectType, number, number][] = [
  ['semisextile', 30, 2],
  ['semisquare', 45, 2],
  ['quintile', 72, 2],
  ['sesquiquadrate', 135, 2],
  ['biquintile', 144, 2],
  ['quincunx', 150, 3],
];
const allOff: AspectEnabledConfig = Object.fromEntries(
  Object.keys(ASPECT_DEFINITIONS).map((type) => [type, false]),
);
const pair = (angle: number) => [
  { id: 'a', name: 'A', longitude: 359 },
  { id: 'b', name: 'B', longitude: (359 + angle) % 360 },
];

describe('aspect enablement', () => {
  it('keeps the five original types enabled by default, even with wider minor orbs', () => {
    expect(
      Object.keys(DEFAULT_ENABLED_ASPECTS).filter(
        (type) => DEFAULT_ENABLED_ASPECTS[type as AspectType],
      ),
    ).toEqual(['conjunction', 'sextile', 'square', 'trine', 'opposition']);
    for (const [angle, type] of [
      [0, 'conjunction'],
      [60, 'sextile'],
      [90, 'square'],
      [120, 'trine'],
      [180, 'opposition'],
    ] as const)
      expect(calculateAspects(pair(angle))[0]?.type).toBe(type);
    for (const [type, angle] of minorAspects)
      expect(calculateAspects(pair(angle), { [type]: 30 })).toEqual([]);
  });

  it.each(minorAspects)(
    'calculates %s at %s° with inclusive %s° orbs across the zodiac seam',
    (type, angle, orb) => {
      const enabled = { ...allOff, [type]: true };
      for (const offset of [-orb, 0, orb]) {
        const aspects = calculateAspects(pair(angle + offset), {}, enabled);
        expect(aspects).toHaveLength(1);
        expect(aspects[0]).toMatchObject({
          type,
          angle,
          separation: angle + offset,
          orb: Math.abs(offset),
        });
      }
      expect(calculateAspects(pair(angle + orb + 0.001), {}, enabled)).toEqual([]);
      expect(calculateAspects(pair(angle), { [type]: 0 }, enabled)).toHaveLength(1);
      expect(calculateAspects(pair(angle + 0.001), { [type]: 0 }, enabled)).toEqual([]);
      expect(calculateAspects([...pair(angle)].reverse(), {}, enabled)[0]?.id).toBe(
        calculateAspects(pair(angle), {}, enabled)[0]?.id,
      );
    },
  );

  it('excludes disabled types before closest-angle matching and retains deterministic ties', () => {
    const bodies = pair(72);
    const orbs = { sextile: 20 };
    expect(calculateAspects(bodies, orbs)[0]).toMatchObject({ type: 'sextile', orb: 12 });
    expect(calculateAspects(bodies, orbs, { quintile: true })[0]).toMatchObject({
      type: 'quintile',
      orb: 0,
    });
    expect(calculateAspects(bodies, orbs, allOff)).toEqual([]);
    expect(calculateAspects(pair(75), { sextile: 20, square: 20 })[0]?.type).toBe('sextile');
  });

  it('filters supplied aspects and dependent groups, retaining original input and body-only groups', () => {
    const input: ChartInput = {
      bodies: pair(170),
      aspects: [{ id: 'custom', type: 'quincunx', bodyIds: ['a', 'b'] }],
      groups: [
        { id: 'dependent', name: 'Supplied configuration', bodyIds: ['a'], aspectIds: ['custom'] },
        { id: 'bodies', name: 'Body group', bodyIds: ['a', 'b'], aspectIds: [] },
      ],
    };
    const original = structuredClone(input);
    const off = createModel(input);
    expect(off.aspects).toEqual([]);
    expect(off.groups.map((group) => group.id)).toEqual(['bodies']);
    expect(getSelectionDetails(off, { kind: 'body', id: 'a' })?.aspects).toEqual([]);
    expect(getSelectionDetails(off, { kind: 'aspect', id: 'custom' })).toBeNull();
    const on = createModel(input, { enabledAspects: { quincunx: true }, orbs: { quincunx: 0 } });
    expect(on.aspects[0]).toMatchObject({ id: 'custom', type: 'quincunx', orb: 20 });
    expect(on.groups).toHaveLength(2);
    expect(Object.isFrozen(on.aspects[0])).toBe(true);
    expect(input).toEqual(original);
    expect(Object.isFrozen(input.aspects![0])).toBe(false);
  });

  it('suppresses and restores groups referencing calculated disabled aspects without dangling references', () => {
    const bodies = pair(30);
    const id = calculateAspects(bodies, {}, { semisextile: true })[0]!.id;
    const input = { bodies, groups: [{ id: 'g', name: 'Pair', bodyIds: [], aspectIds: [id] }] };
    expect(createModel(input).groups).toEqual([]);
    expect(createModel(input, { enabledAspects: { semisextile: true } }).groups).toHaveLength(1);
  });

  it('validates disabled supplied aspects and their group references before filtering', () => {
    const bodies = pair(30);
    const aspect = { id: 'minor', type: 'semisextile' as const, bodyIds: ['a', 'b'] as const };
    expect(() =>
      createModel({ bodies, aspects: [{ ...aspect, bodyIds: ['a', 'missing'] }] }),
    ).toThrow('missing body');
    expect(() => createModel({ bodies, aspects: [aspect, aspect] })).toThrow('Duplicate ID');
    expect(() =>
      createModel({
        bodies,
        aspects: [aspect],
        groups: [{ id: 'g', name: 'Bad', bodyIds: [], aspectIds: ['missing'] }],
      }),
    ).toThrow('missing aspect');
    expect(() =>
      createModel({ bodies, aspects: [{ ...aspect, type: 'other' as AspectType }] }),
    ).toThrow('Unsupported');
  });

  it.each([
    { enabledAspects: { quincunx: 1 } },
    { enabledAspects: { quincunx: undefined } },
    { enabledAspects: { other: true } },
    { enabledAspects: null },
    { enabledAspects: [] },
    { orbs: { quincunx: NaN } },
    { orbs: { semisextile: -1 } },
    { orbs: { quintile: 181 } },
  ])('rejects invalid settings even when there are no calculated aspects: %j', (options) => {
    expect(() =>
      createModel({ bodies: [], aspects: [] }, options as unknown as ModelOptions),
    ).toThrow();
  });
});

describe('transit aspect enablement', () => {
  it.each(minorAspects)('enables %s independently in each family', (type, angle) => {
    const input = { natal: { bodies: pair(angle) }, transit: { bodies: pair(angle) } };
    const baseline = createTransitModel(input);
    for (const family of ['natal', 'cross', 'transit'] as const) {
      const model = createTransitModel(input, { enabledAspects: { [family]: { [type]: true } } });
      const counts = {
        natal: model.natal.aspects.filter((a) => a.type === type).length,
        cross: model.crossAspects.filter((a) => a.type === type).length,
        transit: model.transit.aspects.filter((a) => a.type === type).length,
      };
      expect(counts).toEqual({
        natal: family === 'natal' ? 1 : 0,
        cross: family === 'cross' ? 2 : 0,
        transit: family === 'transit' ? 1 : 0,
      });
      for (const other of ['natal', 'transit'] as const)
        if (other !== family) expect(model[other]).toEqual(baseline[other]);
      const aspects = family === 'cross' ? model.crossAspects : model[family].aspects;
      const aspect = aspects.find((a) => a.type === type)!;
      expect(
        getTransitSelectionDetails(model, { chart: family, kind: 'aspect', id: aspect.id })
          ?.aspects[0]?.type,
      ).toBe(type);
    }
  });

  it('filters supplied cross aspects independently of orbs and still validates disabled input', () => {
    const input = {
      natal: { bodies: pair(0) },
      transit: { bodies: pair(0) },
      crossAspects: [
        {
          id: 'q',
          type: 'quincunx' as const,
          bodyRefs: [
            { chart: 'natal' as const, id: 'a' },
            { chart: 'transit' as const, id: 'a' },
          ] as const,
        },
      ],
    };
    expect(createTransitModel(input).crossAspects).toEqual([]);
    const on = createTransitModel(input, {
      orbs: { cross: { quincunx: 0 } },
      enabledAspects: { cross: { quincunx: true } },
    });
    expect(on.crossAspects[0]).toMatchObject({ id: 'q', orb: 150 });
    expect(() =>
      createTransitModel({
        ...input,
        crossAspects: [input.crossAspects[0]!, input.crossAspects[0]!],
      }),
    ).toThrow('unique');
    expect(() =>
      createTransitModel(input, {
        enabledAspects: { cross: { quincunx: 1 as unknown as boolean } },
      }),
    ).toThrow('boolean');
    expect(() =>
      createTransitModel({
        ...input,
        crossAspects: [
          {
            ...input.crossAspects[0]!,
            bodyRefs: [
              { chart: 'natal', id: 'a' },
              { chart: 'transit', id: 'missing' },
            ],
          },
        ],
      }),
    ).toThrow('existing');
  });
});
