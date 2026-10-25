import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';

test('homepage templates show the same positions with different presets and restore after navigation', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  const section = page.getByRole('region', { name: 'Make the chart yours' });
  await expect(section).toBeVisible();
  const midnight = section.locator('[data-template-preview=midnight] .astr3');
  const paper = section.locator('[data-template-preview=paper] .astr3');
  await expect(midnight).toHaveAttribute('data-layout', 'alternative');
  await expect(paper).toHaveAttribute('data-layout', 'default');
  await expect(midnight).toHaveCSS('background-color', 'rgb(16, 24, 39)');
  await expect(paper).toHaveCSS('background-color', 'rgb(247, 245, 237)');
  for (const root of [midnight, paper]) {
    await expect(root.locator('.astr3-body')).toHaveCount(3);
    await expect(root.locator('canvas')).toHaveCount(1);
    await expect(root.locator('.astr3-body[data-object="body:sun"]')).toHaveAttribute(
      'title',
      'Sun · 0°00′ Aries',
    );
  }
  await expect(midnight.locator('.astr3-access')).toHaveAttribute(
    'aria-label',
    'Midnight template preview',
  );
  await expect(paper.locator('.astr3-access')).toHaveAttribute(
    'aria-label',
    'Paper template preview',
  );
  expect(await section.locator('pre code').textContent()).toBe(
    await readFile(new URL('../../examples/json-templates/midnight.json', import.meta.url), 'utf8'),
  );
  expect(
    await section.evaluate((element) =>
      element.previousElementSibling?.classList.contains('feature-strip'),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await section.screenshot({ path: testInfo.outputPath('homepage-templates.png') });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(section.locator('.astr3, canvas')).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(section.locator('.astr3')).toHaveCount(2);
  await section.getByRole('link', { name: 'Explore JSON templates' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('JSON templates');
});

test('template example mounts fresh natal/transit charts, displays source, and downloads exact JSON and SVG', async ({
  page,
}) => {
  await page.goto('./examples/');
  await page.getByRole('link', { name: /JSON templates/ }).click();
  for (const name of ['midnight', 'paper', 'transit']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('link', { name: `Download ${name}.json`, exact: false }).click();
    const file = await pending;
    expect(file.suggestedFilename()).toBe(`${name}.json`);
    expect(await file.failure()).toBeNull();
    expect(await readFile((await file.path())!, 'utf8')).toBe(
      await readFile(
        new URL(`../../examples/json-templates/${name}.json`, import.meta.url),
        'utf8',
      ),
    );
  }
  await page.getByRole('button', { name: 'Load live preview' }).click();
  const frame = page.frameLocator('iframe');
  const root = frame.locator('.astr3');
  await expect(root).toHaveCount(1);
  for (const name of ['midnight', 'paper', 'transit', 'midnight']) {
    const old = await root.elementHandle();
    await frame.getByLabel('Template', { exact: true }).selectOption(name);
    expect(await old!.evaluate((element) => element.isConnected)).toBe(false);
    await expect(root).toHaveCount(1);
    await expect(root.locator('canvas')).toHaveCount(1);
    await expect(root).toHaveAttribute('data-layout', name === 'paper' ? 'default' : 'alternative');
    if (name === 'transit') {
      // Narrow wheels may compact a natal label while retaining its dot/list entry.
      await expect(root.locator('.astr3-body[data-chart=transit]')).toHaveCount(2);
      await expect(
        root.locator('.astr3-body[data-chart=transit][data-body-id=jupiter]'),
      ).toHaveCount(0);
    } else await expect(root.locator('.astr3-body')).toHaveCount(3);
    await frame.getByText('Selected template JSON', { exact: true }).click();
    const expected = JSON.parse(
      await readFile(
        new URL(`../../examples/json-templates/${name}.json`, import.meta.url),
        'utf8',
      ),
    );
    expect(JSON.parse((await frame.locator('#template-json').textContent())!)).toEqual(expected);
    await frame.getByText('Selected template JSON', { exact: true }).click();
    const pendingJson = page.waitForEvent('download');
    await frame.getByRole('link', { name: 'Download JSON', exact: true }).click();
    const json = await pendingJson;
    expect(json.suggestedFilename()).toBe(`${name}.json`);
    expect(JSON.parse(await readFile((await json.path())!, 'utf8'))).toEqual(expected);
    const pendingSvg = page.waitForEvent('download');
    await frame.getByRole('button', { name: 'Download SVG', exact: true }).click();
    const svg = await pendingSvg;
    expect(svg.suggestedFilename()).toBe(`astr3-${name}.svg`);
    expect(await svg.failure()).toBeNull();
    const source = await readFile((await svg.path())!, 'utf8');
    expect(source).toContain('width="800" height="800"');
    expect(source).toContain('<path');
    if (name === 'transit') {
      expect(source).toContain('stroke-dasharray="4 3"');
      await root.locator('.astr3-access summary').click();
      await expect(root.locator('.astr3-access button[data-body-id]')).toHaveCount(6);
      await expect(
        root.locator('.astr3-access button[data-chart=natal][data-body-id=sun]'),
      ).toContainText('0°00′ Aries');
      const hidden = root.locator('.astr3-access button[data-chart=transit][data-body-id=jupiter]');
      await expect(hidden).toContainText('hidden on wheel');
      await hidden.click();
      await expect(hidden).toHaveAttribute('aria-pressed', 'true');
    }
  }
});
