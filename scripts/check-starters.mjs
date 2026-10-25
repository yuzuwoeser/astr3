import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { run } from './distributions.mjs';
import { serveDirectory } from './static-server.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

const root = resolve('.release/verified-starters');
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const cache = resolve('.site-cache/starter-npm');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
for (const id of ['javascript', 'typescript', 'react', 'vue', 'svelte', 'angular', 'rails']) {
  const directory = join(root, id);
  run('unzip', ['-q', resolve(`.release/astr3-${id}-${version}.zip`), '-d', directory]);
  for (const file of readdirSync(directory).filter((file) =>
    /\.(js|ts|tsx|vue|svelte|json)$/.test(file),
  )) {
    if (readFileSync(join(directory, file), 'utf8').includes('../shared/'))
      throw new Error(`${id}/${file} still depends on checkout-relative files.`);
  }
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', cache], {
    cwd: directory,
  });
  run('npm', ['run', 'build', '--', '--base', './'], { cwd: directory });
  console.log(`${id} extracted starter installs and builds independently.`);
}
const server = serveDirectory(root);
await once(server, 'listening');
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const id of ['javascript', 'typescript', 'react', 'vue', 'svelte', 'angular', 'rails']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/${id}/dist/`);
    await page.waitForSelector('.astr3-body');
    await page.getByRole('button', { name: 'Rotate positions' }).click();
    await page.waitForFunction(
      () => document.querySelector('output').textContent === 'Sun longitude: 15°',
    );
    await page.getByRole('button', { name: 'Unmount chart' }).click();
    await page.locator('.astr3').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.astr3').count(), 0);
    await page.getByRole('button', { name: 'Mount chart' }).click();
    await page.waitForSelector('.astr3-body');
    assert.equal(await page.locator('.astr3').count(), 1);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${id} extracted starter renders, updates and remounts in Chromium.`);
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
