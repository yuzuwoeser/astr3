import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'astr3-consumer-'));
function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const [pack] = JSON.parse(
    run(
      'npm',
      ['pack', '--json', '--offline', '--ignore-scripts', '--pack-destination', directory],
      root,
    ),
  );
  if (
    pack.files.some((file) =>
      ['tests/', 'demo/', 'site/', 'site-dist/', 'examples/', '.site-cache/'].some((prefix) =>
        file.path.startsWith(prefix),
      ),
    )
  )
    throw new Error('Development files leaked into the package.');
  for (const path of [
    'AGENTS.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CHANGELOG.md',
    'llms.txt',
    'docs/agent-integration.md',
    'dist/export-fonts-OFL.txt',
    'dist/chart-export.js',
    'dist/export-font-data.js',
    'dist/chart-template.d.ts',
    'chart-template.schema.json',
    'docs/releasing.md',
  ])
    if (!pack.files.some((file) => file.path === path))
      throw new Error(`Public documentation missing from package: ${path}`);
  // npm ci caches archive contents, but not necessarily registry manifests.
  // Pack installed peers locally so a clean CI cache cannot affect resolution.
  const localDependency = (name) => {
    const [dependency] = JSON.parse(
      run(
        'npm',
        [
          'pack',
          join(root, 'node_modules', name),
          '--json',
          '--offline',
          '--ignore-scripts',
          '--pack-destination',
          directory,
        ],
        root,
      ),
    );
    return `file:${join(directory, dependency.filename)}`;
  };
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'astr3-consumer-check',
      private: true,
      type: 'module',
      dependencies: {
        astr3: `file:${join(directory, pack.filename)}`,
        three: localDependency('three'),
        'astronomy-engine': localDependency('astronomy-engine'),
      },
    }),
  );
  run('npm', [
    'install',
    '--offline',
    '--cache',
    join(directory, 'npm-cache'),
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ]);
  writeFileSync(
    join(directory, 'consumer.ts'),
    `
import { createChart, createTransitChart, createTransitAnimation, type ChartExportOptions, type ChartPngExportOptions, type BodyVisibility, type TransitBodyVisibility, type TransitAnimation, type TransitAnimationState, type TransitAnimationOptions, type TransitCalculator, type TransitSelection, type TransitChartInput, type Selection, type ChartInput, type ChartWeight, type ChartLayout, type AspectEnabledConfig, type TransitAspectEnabledConfig } from 'astr3';
import { createModel, createTransitModel, calculateAspects, ASPECT_DEFINITIONS, DEFAULT_ENABLED_ASPECTS } from 'astr3/model';
import { createAstronomyProvider } from 'astr3/ephemeris';
import { resolveChartTemplate, resolveTransitChartTemplate, ChartTemplateError, type ChartTemplate, type TransitChartTemplate, type ChartTemplateOptions, type TransitChartTemplateOptions } from 'astr3';
import schema from 'astr3/chart-template.schema.json' with { type: 'json' };
const input: ChartInput = { bodies: [{ id: 'sun', name: 'Sun', longitude: 1 }] };
const selection: Selection = { kind: 'body', id: 'sun' };
const enabledAspects: AspectEnabledConfig = { quincunx: true, square: false };
const model = createModel(input, { enabledAspects });
const chartFactory: typeof createChart = createChart;
const chartWeight: ChartWeight = 'regular';
const layout: ChartLayout = 'alternative';
const bodyVisibility: BodyVisibility = { sun: false };
const options: Parameters<typeof createChart>[1] = { data: input, chartWeight, layout, enabledAspects, bodyVisibility, lineStyles: { quincunx: { dash: [4, 3] } }, theme: { aspects: { quincunx: '#37836e' } } };
const template: ChartTemplate = { version: 1, kind: 'natal', options: { layout, layers: { degrees: false } } };
const appearance: ChartTemplateOptions = resolveChartTemplate(template);
const transitTemplate: TransitChartTemplate = { version: 1, kind: 'transit', options: { glyphs: { transit: { sun: 'S' } }, transitColor: '#abcdef' } };
const transitAppearance: TransitChartTemplateOptions = resolveTransitChartTemplate(transitTemplate);
const fromTemplate: Parameters<typeof createChart>[1] = { ...appearance, data: input, ariaLabel: 'Template consumer' };
const transitFromTemplate: Parameters<typeof createTransitChart>[1] = { ...transitAppearance, data: { natal: input, transit: input } };
const templateError: ChartTemplateError = new ChartTemplateError('version', 'Unsupported version');
void [schema.$schema, fromTemplate, transitFromTemplate, templateError.path, templateError.code];
void [selection, model, chartFactory, createAstronomyProvider, options, calculateAspects(input.bodies, {}, enabledAspects), ASPECT_DEFINITIONS, DEFAULT_ENABLED_ASPECTS];
const pair: TransitChartInput = { natal: input, transit: input };
const transitSelection: TransitSelection = { kind: 'body', chart: 'transit', id: 'sun' };
const enabledFamilies: TransitAspectEnabledConfig = { natal: { semisextile: true }, cross: { quincunx: true } };
const transitModel = createTransitModel(pair, { orbs: { cross: { trine: 3 } }, enabledAspects: enabledFamilies });
const transitVisibility: TransitBodyVisibility = { natal: { sun: true }, transit: { sun: false } };
const transitOptions: Parameters<typeof createTransitChart>[1] = { data: pair, layout, enabledAspects: enabledFamilies, bodyVisibility: transitVisibility, layers: { crossAspects: true }, glyphs: { transit: { sun: 'S' } } };
void [transitSelection, transitModel, transitOptions, createAstronomyProvider().calculateTransits];
const calculator: TransitCalculator = createAstronomyProvider().calculateTransits;
const animationOptions: TransitAnimationOptions = { outerBodyIds: ['jupiter', 'saturn'] };
function animate(chart: ReturnType<typeof createTransitChart>): TransitAnimation {
  const animation = createTransitAnimation(chart, calculator, animationOptions);
  const state: TransitAnimationState = animation.state;
  animation.on('progress', ({ state, data }) => { void [state.currentTime, data.bodies]; });
  chart.on('dispose', () => animation.dispose());
  void [state, animation.pause, animation.resume, animation.cancel, animation.play];
  return animation;
}
void animate;
const exportOptions: ChartExportOptions = { view: 'current', size: 1024, transparent: true };
const pngOptions: ChartPngExportOptions = { ...exportOptions, pixelRatio: 2 };
function exportCharts(natal: ReturnType<typeof createChart>, transit: ReturnType<typeof createTransitChart>) {
  const svg: Promise<string> = natal.exportSvg(exportOptions);
  const png: Promise<Blob> = transit.exportPng(pngOptions);
  return [svg, png, natal.exportPng(), transit.exportSvg()];
}
void exportCharts;
`,
  );
  writeFileSync(
    join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        resolveJsonModule: true,
        strict: true,
        noEmit: true,
        lib: ['ES2022', 'DOM'],
      },
      include: ['consumer.ts'],
    }),
  );
  run(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'),
    '-p',
    join(directory, 'tsconfig.json'),
  ]);
  writeFileSync(
    join(directory, 'runtime.mjs'),
    `
import assert from 'node:assert/strict';
import schema from 'astr3/chart-template.schema.json' with { type: 'json' };
import { resolveChartTemplate, resolveTransitChartTemplate, ChartTemplateError } from 'astr3';
import { createChart, createTransitChart, createTransitAnimation } from 'astr3';
import { createModel, createTransitModel, calculateAspects, ASPECT_DEFINITIONS, DEFAULT_ENABLED_ASPECTS } from 'astr3/model';
import { createAstronomyProvider } from 'astr3/ephemeris';
assert.equal(typeof globalThis.document, 'undefined');
assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.equal(schema.oneOf.length, 2);
assert.deepEqual(resolveChartTemplate({ version: 1, kind: 'natal', options: { layout: 'alternative', theme: { accent: '#abcdef' } } }), { layout: 'alternative', theme: { accent: '#abcdef' } });
assert.deepEqual(resolveTransitChartTemplate({ version: 1, kind: 'transit', options: { transitColor: '#abcdef', bodyVisibility: { transit: { moon: false } } } }), { transitColor: '#abcdef', bodyVisibility: { transit: { moon: false } } });
assert.throws(() => resolveChartTemplate({ version: 2, kind: 'natal', options: {} }), (error) => error instanceof ChartTemplateError && error.path === 'version');
assert.equal(typeof createChart, 'function');
assert.equal(typeof createTransitChart, 'function');
assert.equal(typeof createTransitAnimation, 'function');
assert.equal(createTransitModel({ natal: { bodies: [] }, transit: { bodies: [] } }).crossAspects.length, 0);
assert.equal(createModel({ bodies: [] }).houseStatus, 'unknown');
assert.equal(ASPECT_DEFINITIONS.quincunx.angle, 150);
assert.equal(DEFAULT_ENABLED_ASPECTS.quincunx, false);
const points = [{ id: 'a', name: 'A', longitude: 0 }, { id: 'b', name: 'B', longitude: 30 }];
assert.equal(calculateAspects(points).length, 0);
assert.equal(calculateAspects(points, {}, { semisextile: true })[0].type, 'semisextile');
assert.equal(createTransitModel({ natal: { bodies: [points[0]] }, transit: { bodies: [{ ...points[1], longitude: 150 }] } }, { enabledAspects: { cross: { quincunx: true } } }).crossAspects[0].type, 'quincunx');
const data = await createAstronomyProvider().calculate({ utc: '2000-01-01T12:00:00Z', latitude: 51.5, longitude: 0 });
assert.equal(data.houses.length, 12);
assert.equal(data.bodies.length, 14);
assert.equal(data.bodies.find(body => body.id === 'ascendant').longitude, data.angles.ascendant);
assert.equal(data.bodies.find(body => body.id === 'midheaven').longitude, data.angles.midheaven);
const transits = await createAstronomyProvider().calculateTransits({ utc: '2000-01-01T12:00:00Z' });
assert.equal(transits.bodies.length, 12);
assert.equal(transits.metadata.lunarNodeType, 'true');
assert.equal(transits.bodies.find(body => body.id === 'north-node').metadata.nodeType, 'true');
assert.equal(transits.angles, undefined);
assert.equal(transits.houses, undefined);
`,
  );
  run(process.execPath, ['runtime.mjs']);
  const guide = readFileSync(
    join(directory, 'node_modules/astr3/docs/agent-integration.md'),
    'utf8',
  );
  const example = guide.match(/```js\n([\s\S]*?)\n```/)?.[1];
  if (!example) throw new Error('Agent guide has no complete headless example.');
  writeFileSync(join(directory, 'agent-example.mjs'), example);
  const inspected = JSON.parse(run(process.execPath, ['agent-example.mjs']));
  if (
    inspected.body.id !== 'sun' ||
    inspected.aspects.length !== 2 ||
    inspected.houseStatus !== 'unknown'
  )
    throw new Error('Packed agent guide example does not match its documented result.');
  console.log(
    'Package consumer passed: ESM imports, SSR-safe model/renderer/templates, JSON Schema export, optional adapter, TypeScript declarations.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
