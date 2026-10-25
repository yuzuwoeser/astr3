import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';
import { examples } from '../../examples/registry.mjs';

// Production routes are loaded directly, so a dev-server fallback cannot hide
// missing HTML files or broken /astr3/ asset prefixes.
test('landing, gallery, and integration navigation work without loading frameworks eagerly', async ({
  page,
  assetRequests,
}) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Charts that belong');
  await expect(page.locator('[data-template-preview] .astr3')).toHaveCount(2);
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(assetRequests.some((path) => path.includes('/previews/'))).toBe(false);
  await page.getByRole('navigation').getByRole('link', { name: 'Examples', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Examples');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Integrations', exact: true })
    .click();
  for (const name of ['React', 'Vue.js', 'Svelte', 'Angular', 'PHP', 'WordPress', 'Ruby on Rails'])
    await expect(page.getByRole('heading', { name, level: 3, exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Drupal', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const example of examples) {
  const section = example.category === 'example' ? 'examples' : 'integrations';
  test(`${example.id}: guide and source are generated from canonical files`, async ({ page }) => {
    await page.goto(`./${section}/${example.id}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(example.title);
    await expect(page.getByRole('region', { name: 'Setup instructions' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    if (example.browserOnly)
      await expect(page.locator('.notice')).toContainText('do not run on GitHub Pages');
    for (const [index, file] of example.files.entries()) {
      await page.getByRole('tab', { name: file, exact: true }).click();
      const source = await readFile(new URL(`../../examples/${file}`, import.meta.url), 'utf8');
      expect(await page.locator(`#source-${index} code`).textContent()).toBe(source);
    }
    const first = page.getByRole('tab').first();
    await first.focus();
    await first.press('ArrowRight');
    await expect(page.getByRole('tab').nth(1)).toBeFocused();
    await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const id of [
  'javascript',
  'typescript',
  'html',
  'react',
  'vue',
  'svelte',
  'angular',
  'rails',
]) {
  test(`${id}: live preview renders, updates, and disposes before remount`, async ({ page }) => {
    await page.goto(`./integrations/${id}/`);
    await page.getByRole('button', { name: 'Load live preview' }).click();
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('.astr3')).toHaveCount(1);
    await expect(frame.locator('canvas')).toHaveCount(1);
    const sun = frame.locator('.astr3-body[data-object="body:sun"]');
    await expect(sun).toHaveCount(1);
    await expect(sun).toHaveAttribute('title', 'Sun · 0°00′ Aries');
    await frame.getByRole('button', { name: 'Rotate positions' }).click();
    await expect(frame.locator('output')).toHaveText('Sun longitude: 15°');
    await expect(sun).toHaveAttribute('title', 'Sun · 15°00′ Aries');
    await frame.getByRole('button', { name: 'Unmount chart' }).click();
    await expect(frame.locator('.astr3')).toHaveCount(0);
    await expect(frame.locator('canvas')).toHaveCount(0);
    // Updating while removed is safe; the remount receives the latest data.
    await frame.getByRole('button', { name: 'Rotate positions' }).click();
    await frame.getByRole('button', { name: 'Mount chart' }).click();
    await expect(frame.locator('.astr3')).toHaveCount(1);
    await expect(frame.locator('canvas')).toHaveCount(1);
    await expect(frame.locator('output')).toHaveText('Sun longitude: 30°');
    await expect(sun).toHaveAttribute('title', 'Sun · 0°00′ Taurus');
  });
}

test('Rails browser controller survives Turbo visits and cached Back navigation', async ({
  page,
}) => {
  await page.goto('./previews/rails/');
  await expect(page.locator('.astr3')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rotate positions' }).click();
  await expect(page.locator('output')).toHaveText('Sun longitude: 15°');
  // A full navigation would discard this marker. Turbo retains the window.
  await page.evaluate(() => {
    (window as Window & { turboMarker?: string }).turboMarker = 'retained';
  });
  await page.getByRole('link', { name: 'Navigate away with Turbo' }).click();
  await expect(page.getByRole('heading', { name: 'Chart disconnected' })).toBeVisible();
  await expect(page.locator('.astr3, canvas')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { turboMarker?: string }).turboMarker)).toBe(
    'retained',
  );
  await page.goBack();
  await expect(page.locator('.astr3')).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('output')).toHaveText('Sun longitude: 15°');
  await page.getByRole('link', { name: 'Navigate away with Turbo' }).click();
  await page.getByRole('link', { name: 'Return to chart' }).click();
  await expect(page.locator('.astr3')).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('self-hosted browser modules export SVG/PNG and load optional calculations', async ({
  page,
}) => {
  await page.goto('./downloads/browser/');
  await expect(page.locator('.astr3-body')).toHaveCount(3);
  for (const format of ['SVG', 'PNG']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format}`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`astr3.${format.toLowerCase()}`);
    expect(await download.failure()).toBeNull();
    const bytes = await readFile((await download.path())!);
    if (format === 'SVG') expect(bytes.toString()).toContain('<svg');
    else expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  await page.getByRole('button', { name: 'Calculate J2000' }).click();
  await expect(page.locator('#example > [role=status]')).toHaveText('J2000 calculated locally.');
  await expect(page.locator('.astr3-body')).toHaveCount(14);
});

test('browser ZIP includes the same standalone modules served by the website', async ({
  page,
  baseURL,
}) => {
  await page.goto('./');
  const pending = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download browser bundle' }).click();
  const archive = await pending;
  expect(archive.suggestedFilename()).toBe('astr3-browser.zip');
  expect(await archive.failure()).toBeNull();
  const { spawnSync } = await import('node:child_process');
  const listing = spawnSync('unzip', ['-Z1', (await archive.path())!], { encoding: 'utf8' });
  expect(listing.status, listing.stderr).toBe(0);
  const names = listing.stdout.trim().split('\n');
  for (const file of [
    'index.html',
    'astr3.js',
    'ephemeris.js',
    'embed.js',
    'main.js',
    'chart-data.json',
    'THIRD_PARTY_LICENSES.txt',
    'export-fonts-OFL.txt',
    'LICENSE',
  ])
    expect(names).toContain(file);
  expect(names.some((name) => name.startsWith('chart-export-'))).toBe(true);
  for (const file of names) {
    const content = spawnSync('unzip', ['-p', (await archive.path())!, file]);
    expect(content.status).toBe(0);
    const served = await page.request.get(new URL(`downloads/browser/${file}`, baseURL).href);
    expect(served.ok()).toBe(true);
    expect(await served.body()).toEqual(content.stdout);
  }
});
