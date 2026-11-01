import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

for (const [layout, kind, spacious] of [
  ['alternative', 'natal', false],
  ['alternative', 'transit', false],
  ['advanced', 'natal', false],
  ['advanced', 'transit', false],
  ['advanced', 'transit', true],
] as const) {
  test(`${spacious ? 'spacious ' : ''}${layout} ${kind} templates retain presentation, accessible hidden bodies, and SVG export`, async ({
    page,
  }, testInfo) => {
    if (spacious) await page.setViewportSize({ width: 2600, height: 2700 });
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
    template.options.layout = layout;
    if (kind === 'natal') {
      template.options.glyphs = { sun: 'S' };
      template.options.bodyVisibility = { jupiter: false };
    }
    await page.evaluate(
      async ({ kind, template, spacious }) => {
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
        host.style.cssText = spacious
          ? 'position:absolute;left:0;top:0;width:2400px;z-index:100;background:#111c20'
          : 'width:min(100%, 600px)';
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
      { kind, template, spacious },
    );
    const root = page.locator('#template-fixture .astr3');
    await expect(root).toHaveAttribute('data-layout', layout);
    await expect(root).toHaveCSS('background-color', 'rgb(16, 24, 39)');
    await expect(root.locator('canvas')).toHaveCount(1);
    if (layout === 'advanced' && !spacious)
      await page.evaluate(async (kind) => {
        const chart = kind === 'natal' ? window.astr3 : window.astr3Transit!;
        chart.zoomBy(1200 / Math.max(280, chart.element.getBoundingClientRect().width));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }, kind);
    if (layout === 'alternative' || spacious)
      await expect(root.locator('.astr3-body')).toHaveCount(kind === 'natal' ? 2 : 5);
    if (spacious) await expect(root.locator('.astr3-cluster')).toHaveCount(0);
    if (layout === 'advanced') {
      const bodies = [
        { id: 'sun', name: 'Sun', position: '0° ♈︎ 00′' },
        { id: 'moon', name: 'Moon', position: '0° ♌︎ 00′' },
        { id: 'jupiter', name: 'Jupiter', position: '0° ♐︎ 00′' },
      ];
      const expected =
        kind === 'natal'
          ? bodies.slice(0, 2).map((body) => ({ ...body, chart: undefined }))
          : (['natal', 'transit'] as const).flatMap((chart) =>
              bodies
                .filter((body) => chart === 'natal' || body.id !== 'jupiter')
                .map((body) => ({ ...body, chart })),
            );
      await expect
        .poll(() =>
          root.evaluate(
            (root) =>
              root.querySelectorAll('.astr3-body').length +
              [...root.querySelectorAll('.astr3-cluster')].reduce(
                (count, badge) => count + Number(badge.textContent),
                0,
              ),
          ),
        )
        .toBe(expected.length);
      for (const body of expected) {
        const label = root.locator(
          body.chart
            ? `.astr3-body[data-chart=${body.chart}][data-body-id=${body.id}]`
            : `.astr3-body[data-object="body:${body.id}"]`,
        );
        if (await label.count()) {
          await expect(label).toHaveCount(1);
          await expect(label.locator('small')).toHaveText(body.position);
        } else {
          const name = body.chart
            ? `${body.chart === 'natal' ? 'Natal' : 'Transiting'} ${body.name}`
            : body.name;
          const badge = root.locator('.astr3-clusters').getByRole('button', {
            name: new RegExp(`clustered bodies:.*\\b${name}(?:,|$)`),
          });
          await expect(badge).toHaveCount(1);
          if (body.chart) await expect(badge).toHaveAttribute('data-chart', body.chart);
          // Keyboard activation also works when zoom clips the badge's position.
          await badge.press('Enter');
          await root
            .locator('.astr3-chooser')
            .getByRole('button', {
              name: new RegExp(`^${name} · `),
            })
            .click();
          await expect
            .poll(() =>
              page.evaluate(
                (kind) => (kind === 'natal' ? window.astr3 : window.astr3Transit!).selection,
                kind,
              ),
            )
            .toEqual({ kind: 'body', id: body.id, ...(body.chart ? { chart: body.chart } : {}) });
        }
      }
    } else await expect(root.locator('.astr3-body small')).toHaveCount(0);
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
