import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';

for (const [route, file, language] of [
  ['integrations/javascript/', 'javascript/main.js', 'javascript'],
  ['integrations/typescript/', 'typescript/main.ts', 'typescript'],
  ['integrations/react/', 'react/Wheel.tsx', 'typescript'],
  ['integrations/vue/', 'vue/Wheel.vue', 'xml'],
  ['integrations/svelte/', 'svelte/Wheel.svelte', 'xml'],
  ['integrations/php/', 'php/chart.php', 'php-template'],
  ['integrations/rails/', 'rails/chart.html.erb', 'erb'],
  ['examples/json-templates/', 'json-templates/midnight.json', 'json'],
]) {
  test(`${file}: highlights source without changing its text`, async ({ page }) => {
    await page.goto(`./${route}`);
    const tab = page.getByRole('tab', { name: file, exact: true });
    await tab.click();
    const panel = page.locator(`#${await tab.getAttribute('aria-controls')}`);
    const code = panel.locator('pre > code');
    await expect(code).toHaveAttribute('data-syntax-highlighted', language!);
    expect(await code.locator('span[class^=hljs-]').count()).toBeGreaterThan(0);
    const source = await readFile(new URL(`../../examples/${file}`, import.meta.url), 'utf8');
    expect(await code.textContent()).toBe(source);
    expect(
      await code.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.toString();
      }),
    ).toBe(source);
    await expect(code.locator('script, link, iframe, img')).toHaveCount(0);
    expect(
      await code
        .locator('span[class^=hljs-]')
        .evaluateAll((tokens) =>
          tokens.some(
            (token) =>
              getComputedStyle(token).color !== getComputedStyle(token.parentElement!).color,
          ),
        ),
    ).toBe(true);
  });
}

test('guide fences use a light palette and source tokens use a dark palette', async ({ page }) => {
  await page.goto('./integrations/javascript/');
  const guide = page.locator('.guide pre code').first();
  const source = page.locator('#source-0 pre code');
  await expect(guide).toHaveAttribute('data-syntax-highlighted', 'sh');
  await expect(source).toHaveAttribute('data-syntax-highlighted', 'javascript');
  await expect(guide).toHaveCSS('color', 'rgb(38, 58, 62)');
  await expect(source).toHaveCSS('color', 'rgb(210, 229, 220)');
  const tab = page.getByRole('tab').first();
  await tab.focus();
  await tab.press('ArrowRight');
  await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel').filter({ visible: true })).toHaveCount(1);
});

test('homepage JSON is highlighted while both chart templates retain their behavior', async ({
  page,
}) => {
  await page.goto('./');
  const section = page.getByRole('region', { name: 'Make the chart yours' });
  const code = section.locator('pre code');
  await expect(code).toHaveAttribute('data-syntax-highlighted', 'json');
  await expect(code.locator('.hljs-attr').first()).toHaveCSS('color', 'rgb(128, 185, 238)');
  expect(await code.textContent()).toBe(
    await readFile(new URL('../../examples/json-templates/midnight.json', import.meta.url), 'utf8'),
  );
  await expect(section.locator('[data-template-preview=midnight] .astr3')).toHaveAttribute(
    'data-layout',
    'alternative',
  );
  await expect(section.locator('[data-template-preview=paper] .astr3')).toHaveAttribute(
    'data-layout',
    'default',
  );
  await expect(section.locator('.astr3-body')).toHaveCount(6);
});
