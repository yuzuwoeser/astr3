import { Color } from 'three';
import { ASPECT_DEFINITIONS } from './model/aspects.js';
import type { ChartOptions } from './types.js';
import type { TransitChartOptions } from './transit-renderer.js';

type PresentationKey =
  | 'layout'
  | 'chartWeight'
  | 'theme'
  | 'glyphs'
  | 'layers'
  | 'bodyVisibility'
  | 'lineStyles'
  | 'selectionEffects'
  | 'dimUnrelated';

/** Creation-time presentation options, without data or calculation settings. */
export type ChartTemplateOptions = Pick<ChartOptions, PresentationKey>;
export type TransitChartTemplateOptions = Pick<
  TransitChartOptions,
  PresentationKey | 'transitColor'
>;

export interface ChartTemplate {
  version: 1;
  name?: string;
  kind: 'natal';
  options: ChartTemplateOptions;
}
export interface TransitChartTemplate {
  version: 1;
  name?: string;
  kind: 'transit';
  options: TransitChartTemplateOptions;
}

export class ChartTemplateError extends Error {
  readonly code = 'INVALID_CHART_TEMPLATE';

  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ChartTemplateError';
  }
}

type Validator = (value: unknown, path: string) => unknown;
const fail = (path: string, message: string): never => {
  throw new ChartTemplateError(path, message);
};
const fieldPath = (path: string, key: string) =>
  /^[a-zA-Z_$][\w$]*$/.test(key)
    ? `${path ? `${path}.` : ''}${key}`
    : `${path}[${JSON.stringify(key)}]`;

function object(value: unknown, path: string): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
    Reflect.ownKeys(value).some((key) => typeof key !== 'string')
  )
    fail(path, 'Expected a JSON object.');
  return value as Record<string, unknown>;
}

function fields(validators: Record<string, Validator>): Validator {
  return (value, path) =>
    Object.fromEntries(
      Object.entries(object(value, path)).map(([key, entry]) => {
        const at = fieldPath(path, key);
        if (!Object.hasOwn(validators, key)) fail(at, 'Unknown field.');
        return [key, validators[key]!(entry, at)];
      }),
    );
}

const string: Validator = (value, path) =>
  typeof value === 'string' ? value : fail(path, 'Expected a string.');
const boolean: Validator = (value, path) =>
  typeof value === 'boolean' ? value : fail(path, 'Expected a boolean.');
const positive: Validator = (value, path) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fail(path, 'Expected a finite, positive number.');
const nonnegative: Validator = (value, path) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fail(path, 'Expected a finite, nonnegative number.');
const opacity: Validator = (value, path) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : fail(path, 'Expected an opacity between 0 and 1.');
const choice =
  (...values: string[]): Validator =>
  (value, path) =>
    typeof value === 'string' && values.includes(value)
      ? value
      : fail(path, `Expected one of: ${values.join(', ')}.`);

// Opaque color syntax understood by both Three.js and the HTML labels. Validate
// without a DOM, color parsing side effects, or accepting ignored alpha values.
const colorSyntax =
  /^(?:#[a-fA-F\d]{3}(?:[a-fA-F\d]{3})?|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgb\(\s*\d+%\s*,\s*\d+%\s*,\s*\d+%\s*\)|hsl\(\s*\d*\.?\d+\s*,\s*\d*\.?\d+%\s*,\s*\d*\.?\d+%\s*\))$/;
const color: Validator = (value, path) =>
  typeof value === 'string' &&
  (colorSyntax.test(value) ||
    (/^[a-zA-Z]+$/.test(value) && Object.hasOwn(Color.NAMES, value.toLowerCase())))
    ? value
    : fail(path, 'Expected an opaque hex, named, rgb(), or hsl() color.');

function tuple(...validators: Validator[]): Validator {
  return (value, path) => {
    if (!Array.isArray(value) || value.length !== validators.length)
      return fail(path, `Expected an array of length ${validators.length}.`);
    return validators.map((validate, index) => validate(value[index], `${path}[${index}]`));
  };
}

function record(validate: Validator): Validator {
  return (value, path) =>
    Object.fromEntries(
      Object.entries(object(value, path)).map(([key, entry]) => {
        const at = fieldPath(path, key);
        if (!key.trim()) fail(at, 'Expected a nonempty body ID.');
        return [key, validate(entry, at)];
      }),
    );
}
const aspects = (validate: Validator) =>
  fields(Object.fromEntries(Object.keys(ASPECT_DEFINITIONS).map((type) => [type, validate])));
const layerFields = {
  zodiac: boolean,
  bodies: boolean,
  houses: boolean,
  axes: boolean,
  aspects: boolean,
  groups: boolean,
  degrees: boolean,
};
const optionFields = {
  layout: choice('default', 'alternative', 'advanced'),
  chartWeight: choice('light', 'regular', 'bold'),
  theme: fields({
    background: color,
    foreground: color,
    muted: color,
    ring: color,
    accent: color,
    group: color,
    elements: tuple(color, color, color, color),
    aspects: aspects(color),
  }),
  glyphs: record(string),
  layers: fields(layerFields),
  bodyVisibility: record(boolean),
  lineStyles: aspects(fields({ width: positive, dash: tuple(positive, nonnegative) })),
  selectionEffects: fields({ color, dimOpacity: opacity, lineWidth: positive }),
  dimUnrelated: boolean,
};
const transitOptionFields = {
  ...optionFields,
  glyphs: fields({ natal: record(string), transit: record(string) }),
  bodyVisibility: fields({ natal: record(boolean), transit: record(boolean) }),
  layers: fields({
    ...layerFields,
    natalBodies: boolean,
    transitBodies: boolean,
    natalAspects: boolean,
    crossAspects: boolean,
    transitAspects: boolean,
  }),
  transitColor: color,
};

function resolve(input: unknown, kind: 'natal' | 'transit'): unknown {
  const template = object(input, '$');
  for (const key of Object.keys(template))
    if (!['version', 'name', 'kind', 'options'].includes(key))
      fail(fieldPath('', key), 'Unknown field.');
  for (const key of ['version', 'kind', 'options'])
    if (!Object.hasOwn(template, key)) fail(key, 'Required field.');
  if (template.version !== 1) fail('version', 'Expected template version 1.');
  if (template.kind !== kind) fail('kind', `Expected a ${kind} template.`);
  if (Object.hasOwn(template, 'name')) string(template.name, 'name');
  return fields(kind === 'natal' ? optionFields : transitOptionFields)(template.options, 'options');
}

/** Validate a natal JSON template and independently copy its presentation options. */
export function resolveChartTemplate(input: unknown): ChartTemplateOptions {
  return resolve(input, 'natal') as ChartTemplateOptions;
}

/** Validate a transit JSON template and independently copy its presentation options. */
export function resolveTransitChartTemplate(input: unknown): TransitChartTemplateOptions {
  return resolve(input, 'transit') as TransitChartTemplateOptions;
}
