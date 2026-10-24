import { expect, test } from '@playwright/test';

test('renders local Righteous 400 text wordmarks in the five-color logo palette', async ({
  page,
}) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url());
  });
  await page.goto('/');
  await expect(page).toHaveTitle('ASTR3 — an explorable sky');
  await expect(page.getByRole('link', { name: 'ASTR3 home', exact: true })).toHaveText('ASTR3');
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    /built with ASTR3/,
  );
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('400 31px "Righteous"', 'ASTR3');
    return faces.map((font) => ({
      family: font.family,
      weight: font.weight,
      style: font.style,
      status: font.status,
    }));
  });
  expect(loaded).toEqual([
    { family: 'Righteous', weight: '400', style: 'normal', status: 'loaded' },
  ]);
  const wordmarks = page.locator('.wordmark');
  await expect(wordmarks).toHaveCount(2);
  for (const wordmark of await wordmarks.all()) {
    await expect(wordmark).toHaveText('ASTR3');
    await expect(wordmark).toHaveCSS('font-family', /Righteous/);
    await expect(wordmark).toHaveCSS('font-weight', '400');
    await expect(wordmark).toHaveCSS('font-kerning', 'normal');
    await expect(wordmark).toHaveCSS('letter-spacing', 'normal');
    await expect(wordmark).toHaveCSS('background-color', 'rgb(17, 28, 32)');
    for (const [character, color] of [
      ['A', 'rgb(118, 199, 178)'],
      ['S', 'rgb(128, 185, 238)'],
      ['T', 'rgb(181, 160, 232)'],
      ['R', 'rgb(239, 147, 153)'],
      ['3', 'rgb(234, 203, 146)'],
    ] as const) {
      const glyph = wordmark.locator('span', { hasText: character });
      await expect(glyph).toHaveText(character);
      await expect(glyph).toHaveCSS('color', color);
    }
    await expect(wordmark.locator('img, svg')).toHaveCount(0);
  }
  expect(fonts.length).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  expect(fonts.every((url) => new URL(url).origin === origin)).toBe(true);
  await expect(page.locator('#chart .astr3')).not.toHaveCSS('font-family', /Righteous/);
  const licenseResponse = await page.request.get('/fonts/OFL.txt');
  expect(licenseResponse.ok()).toBe(true);
  const license = (await licenseResponse.text()).trim();
  expect(license).toContain('Copyright (c) 2011 by Brian J. Bonislawsky DBA Astigmatic');
  expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
  await expect(page.getByRole('link', { name: 'THIRD-PARTY LICENSES' })).toHaveAttribute(
    'href',
    './THIRD_PARTY_LICENSES.txt',
  );
  const notices = await page.request.get('/THIRD_PARTY_LICENSES.txt');
  expect(await notices.text()).toContain(license);
});

test('keeps the ASTR3 name and home link readable when the font cannot load', async ({ page }) => {
  await page.route('**/fonts/Righteous-Regular.ttf', (route) => route.abort());
  await page.goto('/');
  const status = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((font) => font.family === 'Righteous')
      .map((font) => font.status);
  });
  expect(status).toEqual(['error']);
  const home = page.getByRole('link', { name: 'ASTR3 home', exact: true });
  await expect(home).toHaveText('ASTR3');
  await expect(home).toBeVisible();
  await home.focus();
  await expect(home).toBeFocused();
  await expect(page.locator('footer .wordmark')).toHaveText('ASTR3');
  await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
});

test('fits header and footer wordmarks at narrow and wide viewport widths', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [360, 740, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.masthead .wordmark')).toHaveCSS(
      'font-size',
      width <= 740 ? '27px' : '31px',
    );
    await expect(page.locator('footer .wordmark')).toHaveCSS('font-size', '20px');
    const fits = await page.locator('.wordmark').evaluateAll((marks) =>
      marks.every((mark) => {
        const rect = mark.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.width > 0 && rect.height > 0;
      }),
    );
    expect(fits).toBe(true);
  }
});
