import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

for (const kind of ['natal', 'transit'] as const) {
  test(`${kind} templates retain presentation, accessible hidden bodies, and SVG export`, async ({
    page,
  }, testInfo) => {
    await page.goto('/examples/');
    const template = JSON.parse(
      readFileSync(
        new URL(
          `../../examples/json-templates/${kind === 'natal' ? 'midnight' : 'transit'}.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
    if (kind === 'natal') {
      template.options.glyphs = { sun: 'S' };
      template.options.bodyVisibility = { jupiter: false };
    }
    await page.evaluate(
      async ({ kind, template }) => {
        const modulePath = '/library.ts';
        const {
          createChart,
          createTransitChart,
          resolveChartTemplate,
          resolveTransitChartTemplate,
        } = (await import(modulePath)) as typeof import('../../src/index.js');
        const data = {
          bodies: [
            { id: 'sun', name: 'Sun', longitude: 0 },
            { id: 'moon', name: 'Moon', longitude: 120 },
            { id: 'jupiter', name: 'Jupiter', longitude: 240 },
          ],
        };
        const host = document.createElement('div');
        host.id = 'template-fixture';
        host.style.width = 'min(100%, 600px)';
        document.body.append(host);
        if (kind === 'natal') {
          window.astr3 = createChart(host, {
            ...resolveChartTemplate(template),
            data,
            ariaLabel: 'Template browser study',
          });
        } else {
          window.astr3Transit = createTransitChart(host, {
            ...resolveTransitChartTemplate(template),
            data: { natal: data, transit: data },
            ariaLabel: 'Template browser study',
          });
        }
      },
      { kind, template },
    );
    const root = page.locator('#template-fixture .astr3');
    await expect(root).toHaveAttribute('data-layout', 'alternative');
    await expect(root).toHaveCSS('background-color', 'rgb(16, 24, 39)');
    await expect(root.locator('canvas')).toHaveCount(1);
    await expect(root.locator('.astr3-body')).toHaveCount(kind === 'natal' ? 2 : 5);
    await expect(root.locator('.astr3-body small')).toHaveCount(0);
    const side = kind === 'natal' ? '' : '[data-chart=transit]';
    await expect(root.locator(`.astr3-body${side}`).filter({ hasText: 'S' })).toHaveCount(1);
    await expect(root.locator('.astr3-access')).toHaveAttribute(
      'aria-label',
      'Template browser study',
    );
    await root.locator('.astr3-access summary').click();
    const hidden = root.locator(
      kind === 'natal'
        ? '.astr3-access button[data-selection="body:jupiter"]'
        : '.astr3-access button[data-chart=transit][data-body-id=jupiter]',
    );
    await expect(hidden).toContainText('hidden on wheel');
    await hidden.click();
    const result = await page.evaluate(async (kind) => {
      const chart = kind === 'natal' ? window.astr3 : window.astr3Transit!;
      const svg = await chart.exportSvg({ size: 512 });
      const xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
      return {
        error: chart.error,
        selection: chart.selection,
        svg,
        title: xml.querySelector('title')?.textContent,
        parseErrors: xml.querySelectorAll('parsererror').length,
      };
    }, kind);
    expect(result.error).toBeNull();
    expect(result.selection).toEqual({
      kind: 'body',
      id: 'jupiter',
      ...(kind === 'transit' ? { chart: 'transit' } : {}),
    });
    expect(result.parseErrors).toBe(0);
    expect(result.title).toBe('Template browser study');
    expect(result.svg).toContain('fill="#101827"');
    expect(result.svg).toContain('<path');
    expect(result.svg).not.toMatch(/\[&quot;(?:natal|transit|cross)&quot;/);
    await root.screenshot({ path: testInfo.outputPath(`${kind}-template.png`) });
    await page.evaluate(
      (kind) => (kind === 'natal' ? window.astr3 : window.astr3Transit!).dispose(),
      kind,
    );
    await expect(page.locator('#template-fixture .astr3, #template-fixture canvas')).toHaveCount(0);
  });
}
