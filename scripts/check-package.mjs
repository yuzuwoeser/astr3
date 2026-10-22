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
    run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', directory], root),
  );
  if (pack.files.some((file) => file.path.startsWith('tests/') || file.path.startsWith('demo/')))
    throw new Error('Development files leaked into the package.');
  const version = (name) =>
    JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'astr3-consumer-check',
      private: true,
      type: 'module',
      dependencies: {
        astr3: `file:${join(directory, pack.filename)}`,
        three: version('three'),
        'astronomy-engine': version('astronomy-engine'),
      },
    }),
  );
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
  writeFileSync(
    join(directory, 'consumer.ts'),
    `
import { createChart, createTransitChart, type TransitSelection, type TransitChartInput, type Selection, type ChartInput, type ChartWeight } from 'astr3';
import { createModel, createTransitModel } from 'astr3/model';
import { createAstronomyProvider } from 'astr3/ephemeris';
const input: ChartInput = { bodies: [{ id: 'sun', name: 'Sun', longitude: 1 }] };
const selection: Selection = { kind: 'body', id: 'sun' };
const model = createModel(input);
const chartFactory: typeof createChart = createChart;
const chartWeight: ChartWeight = 'regular';
const options: Parameters<typeof createChart>[1] = { data: input, chartWeight };
void [selection, model, chartFactory, createAstronomyProvider, options];
const pair: TransitChartInput = { natal: input, transit: input };
const transitSelection: TransitSelection = { kind: 'body', chart: 'transit', id: 'sun' };
const transitModel = createTransitModel(pair, { orbs: { cross: { trine: 3 } } });
const transitOptions: Parameters<typeof createTransitChart>[1] = { data: pair, layers: { crossAspects: true }, glyphs: { transit: { sun: 'S' } } };
void [transitSelection, transitModel, transitOptions, createAstronomyProvider().calculateTransits];
`,
  );
  writeFileSync(
    join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
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
import { createChart, createTransitChart } from 'astr3';
import { createModel, createTransitModel } from 'astr3/model';
import { createAstronomyProvider } from 'astr3/ephemeris';
assert.equal(typeof globalThis.document, 'undefined');
assert.equal(typeof createChart, 'function');
assert.equal(typeof createTransitChart, 'function');
assert.equal(createTransitModel({ natal: { bodies: [] }, transit: { bodies: [] } }).crossAspects.length, 0);
assert.equal(createModel({ bodies: [] }).houseStatus, 'unknown');
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
  console.log(
    'Package consumer passed: ESM imports, SSR-safe model/renderer import, optional adapter, TypeScript declarations.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
