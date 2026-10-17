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
import { createChart, type Selection, type ChartInput } from 'astr3';
import { createModel } from 'astr3/model';
import { createAstronomyProvider } from 'astr3/ephemeris';
const input: ChartInput = { bodies: [{ id: 'sun', name: 'Sun', longitude: 1 }] };
const selection: Selection = { kind: 'body', id: 'sun' };
const model = createModel(input);
const chartFactory: typeof createChart = createChart;
void [selection, model, chartFactory, createAstronomyProvider];
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
import { createChart } from 'astr3';
import { createModel } from 'astr3/model';
import { createAstronomyProvider } from 'astr3/ephemeris';
assert.equal(typeof globalThis.document, 'undefined');
assert.equal(typeof createChart, 'function');
assert.equal(createModel({ bodies: [] }).houseStatus, 'unknown');
const data = await createAstronomyProvider().calculate({ utc: '2000-01-01T12:00:00Z', latitude: 51.5, longitude: 0 });
assert.equal(data.houses.length, 12);
`,
  );
  run(process.execPath, ['runtime.mjs']);
  console.log(
    'Package consumer passed: ESM imports, SSR-safe model/renderer import, optional adapter, TypeScript declarations.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
