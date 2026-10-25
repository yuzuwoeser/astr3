import { expect, test } from './fixtures.js';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { labelPoint } from '../browser/label-point.js';

async function ready(page: Page) {
  await page.goto('./playground/');
  await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
  await expect.poll(() => page.evaluate(() => window.astr3.error)).toBeNull();
}

test('serves the chart, bundled font, brand assets, and licenses beneath /astr3/', async ({
  page,
  baseURL,
  assetRequests,
}) => {
  await ready(page);
  await expect(page).toHaveTitle('ASTR3 — an explorable sky');
  await expect(page.locator('link[rel=preload][as=font]')).toHaveAttribute(
    'href',
    '/astr3/fonts/Righteous-Regular.ttf',
  );
  expect(
    await page.evaluate(async () => {
      const fonts = await document.fonts.load('400 31px "Righteous"', 'ASTR3');
      return fonts.map((font) => font.status);
    }),
  ).toEqual(['loaded']);
  expect(assetRequests).toContain('/astr3/fonts/Righteous-Regular.ttf');
  expect(
    await page
      .getByRole('link', { name: 'ASTR3 home', exact: true })
      .evaluate((link) => (link as HTMLAnchorElement).href),
  ).toBe(baseURL);
  expect(
    await page
      .getByRole('link', { name: 'THIRD-PARTY LICENSES' })
      .evaluate((link) => (link as HTMLAnchorElement).href),
  ).toBe(new URL('THIRD_PARTY_LICENSES.txt', baseURL).href);
  const license = await page.request.get(new URL('fonts/OFL.txt', baseURL).href);
  expect(license.ok()).toBe(true);
  const licenseText = (await license.text()).trim();
  expect(licenseText).toContain('SIL OPEN FONT LICENSE Version 1.1');
  const notices = await page.request.get(new URL('THIRD_PARTY_LICENSES.txt', baseURL).href);
  expect(notices.ok()).toBe(true);
  expect(await notices.text()).toContain(licenseText);
  expect(await notices.text()).toContain('ASTR3 export outlines');
  for (const filename of ['brand/astr3-logo.svg', 'brand/astr3-logo-preview.svg']) {
    const response = await page.request.get(new URL(filename, baseURL).href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    expect(await response.text()).toContain('<svg');
  }
  const palette = await page.request.get(new URL('brand/palette.json', baseURL).href);
  expect(palette.ok()).toBe(true);
  expect(palette.headers()['content-type']).toContain('application/json');
  const paletteData = await palette.json();
  expect(paletteData).toMatchObject({ text: 'ASTR3', font: 'Righteous' });
  expect(paletteData.characters).toHaveLength(5);
});

async function downloads(page: Page, mode: 'natal' | 'transit') {
  for (const { id, filename, size, png } of [
    { id: 'export-svg', filename: `astr3-${mode}.svg`, size: 800, png: false },
    { id: 'export-svg-large', filename: `astr3-${mode}-large.svg`, size: 1600, png: false },
    { id: 'export-png', filename: `astr3-${mode}.png`, size: 1600, png: true },
  ]) {
    const pending = page.waitForEvent('download');
    await page.locator(`#${id}`).click();
    const file = await pending;
    expect(file.suggestedFilename()).toBe(filename);
    expect(await file.failure()).toBeNull();
    const bytes = await readFile((await file.path())!);
    if (png) {
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
    } else {
      expect(bytes.toString('utf8')).toContain(`width="${size}" height="${size}"`);
      expect(bytes.toString('utf8')).toContain('<path');
    }
    await expect(page.locator('#export-status')).toContainText('download ready.');
  }
}

for (const layout of ['default', 'alternative'] as const) {
  test(`calculates, selects, and downloads natal/transit charts in ${layout} layout`, async ({
    page,
    isMobile,
    assetRequests,
  }) => {
    await ready(page);
    await page.locator('#chart-layout').selectOption(layout);
    await expect(page.locator('#chart .astr3')).toHaveAttribute('data-layout', layout);
    const sun = await labelPoint(page, '#chart .astr3-body[data-object="body:sun"]');
    if (isMobile) await page.touchscreen.tap(sun.x, sun.y);
    else await page.mouse.click(sun.x, sun.y);
    await expect(page.locator('#inspector-heading')).toHaveText('Sun');

    const scriptsBefore = new Set(assetRequests.filter((path) => path.endsWith('.js'))).size;
    await page.locator('#preset').selectOption('j2000');
    await expect(page.locator('#chart-title')).toHaveText('J2000 · London');
    await expect(page.locator('#calculation-status')).toContainText('Calculated locally');
    expect(new Set(assetRequests.filter((path) => path.endsWith('.js'))).size).toBeGreaterThan(
      scriptsBefore,
    );
    const scriptsAfterCalculation = new Set(assetRequests.filter((path) => path.endsWith('.js')))
      .size;
    await downloads(page, 'natal');
    expect(new Set(assetRequests.filter((path) => path.endsWith('.js'))).size).toBeGreaterThan(
      scriptsAfterCalculation,
    );

    await page.locator('#chart-view').selectOption('transit');
    await page.locator('#transit-utc').fill('2024-04-08T18:00');
    await page.locator('#transit-utc').dispatchEvent('change');
    await expect
      .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
      .toBe('2024-04-08T18:00:00.000Z');
    await expect(page.locator('#transit-chart .astr3')).toHaveAttribute('data-layout', layout);
    await expect.poll(() => page.evaluate(() => window.astr3Transit!.error)).toBeNull();
    await page.locator('#transit-chart .astr3-access summary').click();
    await page
      .locator('#transit-chart .astr3-access button[data-chart=transit][data-body-id=sun]')
      .click();
    await expect(page.locator('#inspector-heading')).toHaveText('Transiting Sun');
    await downloads(page, 'transit');
  });
}
