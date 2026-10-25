import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ChartTemplateError,
  resolveChartTemplate,
  resolveTransitChartTemplate,
  type ChartTemplate,
  type TransitChartTemplate,
} from '../../src/index.js';

const schema = JSON.parse(
  readFileSync(new URL('../../chart-template.schema.json', import.meta.url), 'utf8'),
);
const validateSchema = new Ajv2020({ strict: true }).compile(schema);
const natal = (options: unknown = {}) => ({ version: 1, kind: 'natal', options });
const transit = (options: unknown = {}) => ({ version: 1, kind: 'transit', options });
const resolve = (input: unknown) =>
  (input as { kind?: unknown } | null)?.kind === 'transit'
    ? resolveTransitChartTemplate(input)
    : resolveChartTemplate(input);

const complete: ChartTemplate = {
  version: 1,
  kind: 'natal',
  name: 'Invented presentation study',
  options: {
    layout: 'alternative',
    chartWeight: 'bold',
    theme: {
      background: '#101827',
      foreground: 'White',
      muted: '#aBc',
      ring: 'rgb(40, 50, 60)',
      accent: 'rgb(40%, 50%, 60%)',
      group: 'hsl(180, 50%, 70%)',
      elements: ['#f00', '#0F0', '#ff0', '#00f'],
      aspects: { trine: '#123456', quincunx: 'seagreen' },
    },
    glyphs: { sun: 'S', 'future.body': '' },
    layers: {
      zodiac: false,
      bodies: true,
      houses: false,
      axes: true,
      aspects: false,
      groups: true,
      degrees: false,
    },
    bodyVisibility: { moon: false, future: true },
    lineStyles: { trine: { width: 1.5, dash: [4, 3] }, quincunx: { dash: [1, 0] } },
    selectionEffects: { color: '#abc', dimOpacity: 0, lineWidth: 3 },
    dimUnrelated: false,
  },
};
const completeTransit: TransitChartTemplate = {
  version: 1,
  kind: 'transit',
  options: {
    ...complete.options,
    glyphs: { natal: { sun: 'N' }, transit: { sun: 'T' } },
    bodyVisibility: { natal: { sun: true }, transit: { moon: false } },
    layers: {
      natalBodies: true,
      transitBodies: false,
      natalAspects: true,
      crossAspects: false,
      transitAspects: true,
      degrees: false,
    },
    transitColor: '#ef9399',
  },
};

const invalid: [unknown, string][] = [
  [null, '$'],
  [[], '$'],
  ['{}', '$'],
  [false, '$'],
  [{ kind: 'natal', options: {} }, 'version'],
  [{ version: 1, options: {} }, 'kind'],
  [{ version: 1, kind: 'natal' }, 'options'],
  [{ ...natal(), version: 2 }, 'version'],
  [{ ...natal(), version: '1' }, 'version'],
  [{ ...natal(), kind: 'other' }, 'kind'],
  [{ ...natal(), name: 3 }, 'name'],
  [{ ...natal(), data: {} }, 'data'],
  [{ ...natal(), 'unknown.field': true }, '["unknown.field"]'],
  [natal(null), 'options'],
  [natal([]), 'options'],
  [natal({ layout: 'custom' }), 'options.layout'],
  [natal({ chartWeight: 'heavy' }), 'options.chartWeight'],
  [natal({ data: { bodies: [] } }), 'options.data'],
  [natal({ orbs: {} }), 'options.orbs'],
  [natal({ enabledAspects: {} }), 'options.enabledAspects'],
  [natal({ ariaLabel: 'Chart' }), 'options.ariaLabel'],
  [natal({ transitColor: '#fff' }), 'options.transitColor'],
  [natal({ theme: [] }), 'options.theme'],
  [natal({ theme: { unknown: '#fff' } }), 'options.theme.unknown'],
  [natal({ theme: { background: 0 } }), 'options.theme.background'],
  [natal({ theme: { accent: 'not-a-color' } }), 'options.theme.accent'],
  [natal({ theme: { accent: 'darKgreen' } }), 'options.theme.accent'],
  [natal({ theme: { accent: '' } }), 'options.theme.accent'],
  [natal({ theme: { accent: '#abcd' } }), 'options.theme.accent'],
  [natal({ theme: { accent: 'var(--accent)' } }), 'options.theme.accent'],
  [natal({ theme: { accent: 'rgba(0,0,0,0.5)' } }), 'options.theme.accent'],
  [natal({ theme: { accent: 'rgb(1,2,3)junk' } }), 'options.theme.accent'],
  [natal({ theme: { accent: 'rgb(1%,2,3)' } }), 'options.theme.accent'],
  [natal({ theme: { elements: ['red', 'blue', 'green'] } }), 'options.theme.elements'],
  [natal({ theme: { elements: ['red', 'blue', null, 'green'] } }), 'options.theme.elements[2]'],
  [natal({ theme: { aspects: { unknown: '#fff' } } }), 'options.theme.aspects.unknown'],
  [natal({ theme: { aspects: { trine: false } } }), 'options.theme.aspects.trine'],
  [natal({ glyphs: { sun: 1 } }), 'options.glyphs.sun'],
  [natal({ glyphs: { ' ': 'S' } }), 'options.glyphs[" "]'],
  [natal({ layers: { crossAspects: true } }), 'options.layers.crossAspects'],
  [natal({ layers: { degrees: 'false' } }), 'options.layers.degrees'],
  [natal({ bodyVisibility: { sun: 'off' } }), 'options.bodyVisibility.sun'],
  [natal({ bodyVisibility: { '': false } }), 'options.bodyVisibility[""]'],
  [natal({ lineStyles: { unknown: {} } }), 'options.lineStyles.unknown'],
  [natal({ lineStyles: { trine: { color: '#fff' } } }), 'options.lineStyles.trine.color'],
  [natal({ lineStyles: { trine: { width: 0 } } }), 'options.lineStyles.trine.width'],
  [natal({ lineStyles: { trine: { width: -1 } } }), 'options.lineStyles.trine.width'],
  [natal({ lineStyles: { trine: { dash: [1] } } }), 'options.lineStyles.trine.dash'],
  [natal({ lineStyles: { trine: { dash: [1, 2, 3] } } }), 'options.lineStyles.trine.dash'],
  [natal({ lineStyles: { trine: { dash: [0, 1] } } }), 'options.lineStyles.trine.dash[0]'],
  [natal({ lineStyles: { trine: { dash: [1, -1] } } }), 'options.lineStyles.trine.dash[1]'],
  [natal({ selectionEffects: { dimOpacity: -0.1 } }), 'options.selectionEffects.dimOpacity'],
  [natal({ selectionEffects: { dimOpacity: 1.1 } }), 'options.selectionEffects.dimOpacity'],
  [natal({ selectionEffects: { lineWidth: 0 } }), 'options.selectionEffects.lineWidth'],
  [natal({ selectionEffects: { color: 'invalid' } }), 'options.selectionEffects.color'],
  [natal({ selectionEffects: { extra: true } }), 'options.selectionEffects.extra'],
  [natal({ dimUnrelated: 0 }), 'options.dimUnrelated'],
  [transit({ transitColor: 'invalid' }), 'options.transitColor'],
  [transit({ glyphs: { sun: 'S' } }), 'options.glyphs.sun'],
  [transit({ glyphs: { natal: { sun: false } } }), 'options.glyphs.natal.sun'],
  [transit({ bodyVisibility: { sun: false } }), 'options.bodyVisibility.sun'],
  [transit({ bodyVisibility: { cross: {} } }), 'options.bodyVisibility.cross'],
  [transit({ bodyVisibility: { transit: [] } }), 'options.bodyVisibility.transit'],
  [transit({ bodyVisibility: { natal: { moon: 0 } } }), 'options.bodyVisibility.natal.moon'],
  [transit({ layers: { crossAspects: 0 } }), 'options.layers.crossAspects'],
  [transit({ enabledAspects: { cross: {} } }), 'options.enabledAspects'],
];

describe('JSON chart templates', () => {
  it('returns partial options without filling defaults or leaking envelope fields', () => {
    expect(resolveChartTemplate(natal())).toEqual({});
    expect(resolveTransitChartTemplate(transit())).toEqual({});
    expect(
      resolveChartTemplate({ ...natal({ layers: { degrees: false } }), name: 'Study' }),
    ).toEqual({ layers: { degrees: false } });
    expect(resolveChartTemplate(complete)).toEqual(complete.options);
    expect(resolveTransitChartTemplate(completeTransit)).toEqual(completeTransit.options);
    expect(typeof globalThis.document).toBe('undefined');
  });

  it('rejects a valid template passed to the wrong resolver', () => {
    for (const run of [
      () => resolveChartTemplate(completeTransit),
      () => resolveTransitChartTemplate(complete),
    ])
      expect(run).toThrow(
        expect.objectContaining({ path: 'kind', code: 'INVALID_CHART_TEMPLATE' }),
      );
  });

  it.each(invalid)('rejects invalid JSON %# at %s', (input, path) => {
    expect(() => resolve(input)).toThrow(ChartTemplateError);
    expect(() => resolve(input)).toThrow(
      expect.objectContaining({ name: 'ChartTemplateError', code: 'INVALID_CHART_TEMPLATE', path }),
    );
    try {
      resolve(input);
    } catch (error) {
      expect((error as Error).message).toContain(path);
    }
  });

  it('agrees with the strict schema on valid and invalid JSON fixtures', () => {
    const valid = [
      natal(),
      transit(),
      complete,
      completeTransit,
      natal({ layout: 'default', chartWeight: 'light', selectionEffects: { dimOpacity: 1 } }),
      natal({ chartWeight: 'regular', lineStyles: { trine: {} } }),
      transit({ glyphs: {}, bodyVisibility: { transit: {} }, layers: { bodies: false } }),
      ...['midnight', 'paper', 'transit'].map((file) =>
        JSON.parse(
          readFileSync(
            new URL(`../../examples/json-templates/${file}.json`, import.meta.url),
            'utf8',
          ),
        ),
      ),
      ...Object.keys(Color.NAMES)
        .flatMap((color) => [color, color.toUpperCase()])
        .map((color) => natal({ theme: { accent: color } })),
    ];
    for (const input of valid) {
      expect(validateSchema(input), JSON.stringify(validateSchema.errors)).toBe(true);
      expect(() => resolve(input)).not.toThrow();
    }
    for (const [input] of invalid) expect(validateSchema(input), JSON.stringify(input)).toBe(false);
  });

  it('copies every nested record and tuple, without freezing or sharing caller objects', () => {
    for (const template of [complete, completeTransit]) {
      const input = structuredClone(template);
      const before = structuredClone(input);
      const first = resolve(input);
      const second = resolve(input);
      function independent(a: unknown, b: unknown) {
        if (!a || typeof a !== 'object') return;
        expect(a).not.toBe(b);
        expect(Object.isFrozen(a)).toBe(false);
        for (const key of Object.keys(a))
          independent((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
      }
      independent(first, input.options);
      independent(first, second);
      Object.assign(first.theme!.elements!, { 0: '#123' });
      first.lineStyles!.trine!.dash = [9, 8];
      first.selectionEffects!.dimOpacity = 0.7;
      expect(input).toEqual(before);
      expect(second).toEqual(before.options);
      input.options.theme!.background = '#fff';
      expect(first.theme!.background).toBe('#101827');
      expect(second.theme!.background).toBe('#101827');
      const frozen = Object.freeze({
        ...natal(Object.freeze({ theme: Object.freeze({ accent: '#fff' }) })),
      });
      expect(resolve(frozen)).toEqual({ theme: { accent: '#fff' } });
    }
  });

  it('handles body IDs that coincide with object prototype properties safely', () => {
    const glyphs = JSON.parse('{"__proto__":"S","constructor":"C","toString":"T"}');
    const output = resolveChartTemplate(natal({ glyphs })).glyphs!;
    expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
    expect(Object.hasOwn(output, '__proto__')).toBe(true);
    expect(output['__proto__']).toBe('S');
    expect(() => resolveChartTemplate(natal({ constructor: {} }))).toThrow(ChartTemplateError);
  });

  it('rejects non-JSON objects, explicit undefined, and nonfinite numbers', () => {
    for (const input of [
      undefined,
      new Date(),
      new Map(),
      Object.create({ version: 1, kind: 'natal', options: {} }),
      { ...natal(), [Symbol('extra')]: true },
      natal({ theme: new Date() }),
      natal({ layout: undefined }),
      { ...natal(), name: undefined },
      natal({ dimUnrelated: () => true }),
    ])
      expect(() => resolve(input)).toThrow(ChartTemplateError);
    for (const value of [NaN, Infinity, -Infinity]) {
      for (const options of [
        { lineStyles: { trine: { width: value } } },
        { lineStyles: { trine: { dash: [1, value] } } },
        { selectionEffects: { dimOpacity: value } },
      ])
        expect(() => resolveChartTemplate(natal(options))).toThrow(ChartTemplateError);
    }
  });
});
