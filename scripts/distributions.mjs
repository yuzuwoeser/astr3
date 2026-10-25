import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { run } from './process.mjs';
export { run } from './process.mjs';
import { stripTypeScriptTypes } from 'node:module';
import { build } from 'vite';
import { chartData } from '../examples/shared/data.ts';
import { examples } from '../examples/registry.mjs';

export function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

export function filesIn(directory, prefix = '') {
  return readdirSync(directory)
    .flatMap((name) => {
      const relative = join(prefix, name);
      return statSync(join(directory, name)).isDirectory()
        ? filesIn(join(directory, name), relative)
        : [relative];
    })
    .sort();
}

// ZIP timestamps and file ordering must not change on a release-workflow rerun.
export function zip(directory, archive) {
  const files = filesIn(directory);
  for (const file of files) utimesSync(join(directory, file), 946684800, 946684800);
  run('zip', ['-X', '-q', resolve(archive), '-@'], {
    cwd: directory,
    input: files.join('\n') + '\n',
    env: { ...process.env, TZ: 'UTC' },
  });
}

export async function buildBrowser(directory, packageDirectory) {
  for (const [name, entry] of [
    ['astr3', 'index.js'],
    ['ephemeris', 'ephemeris/index.js'],
  ]) {
    await build({
      configFile: false,
      publicDir: false,
      logLevel: 'warn',
      build: {
        outDir: directory,
        emptyOutDir: name === 'astr3',
        lib: {
          entry: join(packageDirectory, 'dist', entry),
          formats: ['es'],
          fileName: () => `${name}.js`,
        },
      },
    });
  }
  for (const file of ['index.html', 'main.js', 'embed.js'])
    cpSync(`examples/html/${file}`, join(directory, file));
  cpSync('examples/shared/preview.css', join(directory, 'preview.css'));
  cpSync('examples/html/minimal.html', join(directory, 'minimal.html'));
  mkdirSync(join(directory, 'presets'), { recursive: true });
  for (const file of ['midnight.json', 'paper.json', 'transit.json'])
    cpSync(`examples/json-templates/${file}`, join(directory, 'presets', file));
  writeJson(join(directory, 'chart-data.json'), chartData());
  for (const file of ['LICENSE', 'NOTICE']) cpSync(file, join(directory, file));
  cpSync('site/public/THIRD_PARTY_LICENSES.txt', join(directory, 'THIRD_PARTY_LICENSES.txt'));
  cpSync('scripts/export-fonts/OFL.txt', join(directory, 'export-fonts-OFL.txt'));
  writeFileSync(
    join(directory, 'README.txt'),
    `ASTR3 browser distribution

Serve this directory over HTTP/HTTPS. Open minimal.html for the smallest starter,
or index.html for the full update/export/calculation demo. No npm or CDN required.
Import createChart from ./astr3.js; optional calculations use ./ephemeris.js.
Keep emitted lazy chunks and license notices together. file:// is unsupported.
Appearance presets live in presets/. Chart data contains invented positions.
See https://github.com/yuzuwoeser/astr3/blob/main/docs/integrations.md
`,
  );
}

export function buildWordpress(directory, browserDirectory, version) {
  const plugin = join(directory, 'astr3');
  mkdirSync(plugin, { recursive: true });
  cpSync('integrations/wordpress', plugin, { recursive: true });
  for (const file of ['astr3.php', 'block.json', 'readme.txt']) {
    const path = join(plugin, file);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll('__VERSION__', version));
  }
  const assets = join(plugin, 'assets');
  mkdirSync(assets, { recursive: true });
  for (const file of filesIn(browserDirectory)) {
    if (file.endsWith('.js') || file.startsWith('presets/') || /LICENSE|NOTICE|OFL/.test(file)) {
      mkdirSync(resolve(assets, file, '..'), { recursive: true });
      cpSync(join(browserDirectory, file), join(assets, file));
    }
  }
  return plugin;
}

export function buildStarters(directory, tarball, version, browserDirectory) {
  mkdirSync(directory, { recursive: true });
  for (const example of examples.filter((entry) =>
    ['browser', 'framework', 'server'].includes(entry.category),
  )) {
    if (example.id === 'html' || example.id === 'wordpress') continue;
    const root = join(directory, example.id);
    mkdirSync(root, { recursive: true });
    for (const file of example.files.filter((file) => file.startsWith(`${example.id}/`))) {
      const name = file.slice(example.id.length + 1);
      if (name === 'package.json' || name === 'tsconfig.json') continue;
      const text = readFileSync(`examples/${file}`, 'utf8')
        .replaceAll('../shared/data.js', './data.js')
        .replaceAll('../shared/data', './data')
        .replaceAll('../shared/preview.css', './style.css');
      writeFileSync(join(root, name), text);
    }
    cpSync('examples/shared/preview.css', join(root, 'style.css'));
    writeFileSync(
      join(root, 'data.js'),
      stripTypeScriptTypes(readFileSync('examples/shared/data.ts', 'utf8')),
    );
    if (example.id === 'php') {
      cpSync(browserDirectory, join(root, 'astr3'), { recursive: true });
      cpSync(join(root, 'php.js'), join(root, 'astr3/php.js'));
    } else {
      const manifest = JSON.parse(readFileSync(`examples/${example.id}/package.json`, 'utf8'));
      manifest.dependencies.astr3 = `file:./astr3-${version}.tgz`;
      manifest.devDependencies = { ...manifest.devDependencies, vite: '^8.3.4' };
      manifest.scripts = { dev: 'vite --host 127.0.0.1', build: 'vite build' };
      writeJson(join(root, 'tsconfig.json'), {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          allowJs: true,
          skipLibCheck: true,
        },
        include: ['*.ts', '*.tsx', '*.js', '*.vue', '*.svelte'],
      });
      if (example.id === 'angular') {
        manifest.scripts = {
          dev: 'ngc -p tsconfig.json && vite --host 127.0.0.1',
          build: 'ngc -p tsconfig.json && vite build',
        };
        const config = JSON.parse(readFileSync('examples/angular/tsconfig.json', 'utf8'));
        config.compilerOptions.rootDir = '.';
        config.compilerOptions.outDir = './compiled';
        config.compilerOptions.allowJs = true;
        delete config.compilerOptions.paths;
        config.include = ['*.ts', 'data.js'];
        writeJson(join(root, 'tsconfig.json'), config);
        const html = join(root, 'index.html');
        writeFileSync(html, readFileSync(html, 'utf8').replace('./main.ts', './compiled/main.js'));
        // Angular's published partial declarations need its linker when bundled.
        writeFileSync(
          join(root, 'vite.config.js'),
          `import linker from '@angular/compiler-cli/linker/babel';
import { transformAsync } from '@babel/core';
export default { plugins: [{ name: 'angular-linker', async transform(code, filename) {
  if (!filename.includes('/@angular/') || !code.includes('ɵɵngDeclare')) return;
  const result = await transformAsync(code, { filename, configFile: false, babelrc: false, plugins: [linker] });
  return result ? { code: result.code, map: result.map } : undefined;
} }] };
`,
        );
        // The emitted main imports this path relative to compiled/.
        mkdirSync(join(root, 'compiled'), { recursive: true });
        cpSync(join(root, 'style.css'), join(root, 'compiled/style.css'));
      } else if (example.id === 'vue' || example.id === 'svelte') {
        const name = example.id;
        const module = name === 'vue' ? '@vitejs/plugin-vue' : '@sveltejs/vite-plugin-svelte';
        writeFileSync(
          join(root, 'vite.config.js'),
          name === 'vue'
            ? `import vue from '${module}';\nexport default { plugins: [vue()] };\n`
            : `import { svelte } from '${module}';\nexport default { plugins: [svelte({ configFile: false })] };\n`,
        );
      }
      if (example.id === 'rails') {
        writeFileSync(
          join(root, 'vite.config.js'),
          "export default { build: { rollupOptions: { input: { main: 'index.html', away: 'away.html' } } } };\n",
        );
        for (const file of ['index.html', 'away.html']) {
          const path = join(root, file);
          writeFileSync(
            path,
            readFileSync(path, 'utf8').replace(
              '__CHART_DATA__',
              JSON.stringify(chartData()).replaceAll('"', '&quot;'),
            ),
          );
        }
        mkdirSync(join(root, 'config'), { recursive: true });
        writeJson(join(root, 'config/chart-data.json'), chartData());
      }
      cpSync(tarball, join(root, `astr3-${version}.tgz`));
      writeJson(join(root, 'package.json'), manifest);
    }
    writeFileSync(
      join(root, 'README.md'),
      `# ASTR3 ${example.title} starter\n\n${example.id === 'php' ? 'Serve chart.php with PHP 8 or later.' : 'Use Node.js 24 LTS. Run npm install, then npm run dev. The local ASTR3 tarball is included; npm publication is not required.'}\n\nData is invented. style.css is demo styling; retain a nonzero chart host width.\nCopy the Wheel component/controller into an existing application, update its data,\nand dispose it before removing its host. Demo rotation/toggle controls are optional.\n\nFull guide: https://yuzuwoeser.github.io/astr3/integrations/${example.id}/\n`,
    );
    zip(root, join(directory, `astr3-${example.id}-${version}.zip`));
  }
}
