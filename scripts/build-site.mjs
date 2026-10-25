import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { build } from 'vite';
import { examples } from '../examples/registry.mjs';
import { chartData } from '../examples/shared/data.ts';
import { escapeHtml, generatePages } from '../site/content.mjs';
import { findDependencyLicense } from './dependency-license.ts';
import { buildBrowser, buildWordpress, buildStarters, zip } from './distributions.mjs';

const argument = process.argv.indexOf('--base');
const base = argument === -1 ? '/' : process.argv[argument + 1];
if (!base || (!/^\/[\w/-]*\/$/.test(base) && base !== '/'))
  throw new Error('Expected an absolute base ending with /.');
const cache = resolve('.site-cache');
const publicDir = join(cache, 'public');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0)
    throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const ids = new Set();
for (const example of examples) {
  if (!/^[a-z][a-z0-9-]*$/.test(example.id) || ids.has(example.id))
    throw new Error(`Invalid or duplicate example: ${example.id}`);
  ids.add(example.id);
  for (const file of [...example.files, `${example.id}/README.md`]) {
    if (!existsSync(resolve('examples', file))) throw new Error(`Missing example source: ${file}`);
  }
}
// Only delete generated build directories, never source or caller data.
rmSync(cache, { recursive: true, force: true });
rmSync('site/.generated', { recursive: true, force: true });
mkdirSync(join(cache, 'package'), { recursive: true });
const [pack] = JSON.parse(
  run('npm', [
    'pack',
    '--offline',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    cache,
    '--cache',
    join(cache, 'npm-cache'),
  ]),
);
run('tar', [
  '-xzf',
  join(cache, pack.filename),
  '--strip-components',
  '1',
  '-C',
  join(cache, 'package'),
]);
cpSync('site/public', publicDir, { recursive: true });
const alias = [
  { find: 'astr3/ephemeris', replacement: join(cache, 'package/dist/ephemeris/index.js') },
  { find: 'astr3/model', replacement: join(cache, 'package/dist/model/index.js') },
  { find: /^astr3$/, replacement: join(cache, 'package/dist/index.js') },
];
const browser = join(publicDir, 'downloads/browser');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
await buildBrowser(browser, join(cache, 'package'));
zip(browser, join(publicDir, 'downloads/astr3-browser.zip'));
cpSync(
  join(publicDir, 'downloads/astr3-browser.zip'),
  join(publicDir, `downloads/astr3-browser-${version}.zip`),
);
const wordpress = join(cache, 'wordpress');
buildWordpress(wordpress, browser, version);
zip(wordpress, join(publicDir, `downloads/astr3-wordpress-${version}.zip`));
cpSync(join(cache, pack.filename), join(publicDir, 'downloads', pack.filename));
buildStarters(join(cache, 'starters'), join(cache, pack.filename), version, browser);
for (const example of examples) {
  const archive = join(cache, 'starters', `astr3-${example.id}-${version}.zip`);
  if (existsSync(archive)) cpSync(archive, join(publicDir, 'downloads', basename(archive)));
}
cpSync(browser, join(publicDir, 'previews/html'), { recursive: true });

for (const example of examples.filter((example) => example.build)) {
  const { id, build: compiler } = example;
  let root = resolve('examples', id);
  const plugins = [];
  if (compiler === 'vue' || compiler === 'svelte') {
    const require = createRequire(join(root, 'package.json'));
    if (compiler === 'vue')
      plugins.push((await import(require.resolve('@vitejs/plugin-vue'))).default());
    else
      plugins.push(
        (await import(require.resolve('@sveltejs/vite-plugin-svelte'))).svelte({
          configFile: false,
        }),
      );
  }
  if (compiler === 'angular') {
    console.log('Compiling Angular templates with the Angular compiler.');
    const workspace = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name;
    run('npm', ['run', 'typecheck', '--workspace', workspace]);
    const require = createRequire(join(root, 'package.json'));
    const { transformAsync } = await import(require.resolve('@babel/core'));
    const { default: linker } = await import(require.resolve('@angular/compiler-cli/linker/babel'));
    // Angular packages ship partial declarations. Link them during compilation
    // so the browser does not need the JIT compiler.
    plugins.push({
      name: 'angular-linker',
      async transform(code, filename) {
        if (!filename.includes('/@angular/') || !code.includes('ɵɵngDeclare')) return;
        const result = await transformAsync(code, {
          filename,
          configFile: false,
          babelrc: false,
          sourceMaps: true,
          plugins: [linker],
        });
        return result ? { code: result.code, map: result.map } : undefined;
      },
    });
    root = join(cache, 'angular', id);
    mkdirSync(join(cache, 'angular/shared'), { recursive: true });
    cpSync('examples/shared/preview.css', join(cache, 'angular/shared/preview.css'));
    writeFileSync(
      join(root, 'index.html'),
      readFileSync(resolve('examples', id, 'index.html'), 'utf8').replace('./main.ts', './main.js'),
    );
  }
  if (compiler === 'rails')
    plugins.push({
      name: 'public-chart-fixture',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace('__CHART_DATA__', escapeHtml(JSON.stringify(chartData()))),
      },
    });
  const input =
    compiler === 'rails'
      ? { main: join(root, 'index.html'), away: join(root, 'away.html') }
      : join(root, 'index.html');
  console.log(`Building ${id} preview against the packed library.`);
  await build({
    configFile: false,
    root,
    publicDir: false,
    base: `${base}previews/${id}/`,
    plugins,
    resolve: { alias },
    build: { outDir: join(publicDir, 'previews', id), emptyOutDir: true, rollupOptions: { input } },
  });
}
for (const example of examples) {
  for (const file of example.downloads ?? [])
    cpSync(resolve('examples', file), join(publicDir, example.preview, basename(file)));
  if (example.id !== 'playground' && !existsSync(join(publicDir, example.preview, 'index.html')))
    throw new Error(`Missing preview: ${example.id}`);
}
// Include notices for framework code embedded in the optional live previews.
let notices = readFileSync(join(publicDir, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
for (const name of [
  'react',
  'react-dom',
  'scheduler',
  'vue',
  '@vue/runtime-dom',
  '@vue/runtime-core',
  '@vue/reactivity',
  '@vue/shared',
  'svelte',
  'esm-env',
  'clsx',
  '@angular/core',
  '@angular/common',
  '@angular/platform-browser',
  'rxjs',
  'tslib',
  '@hotwired/stimulus',
  '@hotwired/turbo',
]) {
  const workspace =
    name.startsWith('@angular') || ['rxjs', 'tslib'].includes(name)
      ? 'angular'
      : name.startsWith('@hotwired')
        ? 'rails'
        : name.startsWith('react') || name === 'scheduler'
          ? 'react'
          : name.startsWith('@vue/')
            ? 'vue'
            : ['esm-env', 'clsx'].includes(name)
              ? 'svelte'
              : name;
  const resolver = createRequire(resolve('examples', workspace, 'package.json'));
  // package.json is not always exported; locate it by walking from the entry.
  let directory = resolve(resolver.resolve(name), '..');
  while (!existsSync(join(directory, 'package.json'))) directory = resolve(directory, '..');
  const license = findDependencyLicense(directory);
  if (!license && name !== '@hotwired/turbo')
    throw new Error(`Missing dependency license: ${name}`);
  const licensePath = license ?? 'site/licenses/turbo-MIT-LICENSE.txt';
  notices += `\n\n${name}\n${readFileSync(licensePath, 'utf8')}`;
}
notices += `\n\nHighlight.js\n${readFileSync(new URL('../node_modules/highlight.js/LICENSE', import.meta.url), 'utf8')}`;
writeFileSync(join(publicDir, 'THIRD_PARTY_LICENSES.txt'), notices);
const input = generatePages(base);
await build({
  configFile: resolve('site/vite.config.ts'),
  base,
  resolve: { alias },
  build: { rollupOptions: { input } },
});
console.log(`ASTR3 website built in site-dist/ (base ${base}).`);
