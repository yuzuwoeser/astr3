import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ChartInput } from '../../src/index.js';
import { polar } from '../../src/layout.js';
import { resolveWheelGeometry } from '../../src/wheel-geometry.js';

const fixture: ChartInput = {
  title: 'Synthetic advanced layout study',
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 5.5, retrograde: true },
    { id: 'moon', name: 'Moon', longitude: 125.5 },
    { id: 'mars', name: 'Mars', longitude: 245.5 },
  ],
  houses: [350, 15, 55, 85, 110, 150, 180, 205, 240, 270, 300, 325].map((longitude, i) => ({
    id: `h${i + 1}`,
    number: i + 1,
    longitude,
  })),
  angles: { ascendant: 0, midheaven: 270 },
  aspects: [{ id: 'trine', type: 'trine', bodyIds: ['sun', 'moon'] }],
};

async function ready(page: Page, transit: boolean) {
  await page.goto('/playground/');
  await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
  await page.locator('#chart-layout').selectOption('advanced');
  if (transit) {
    await page.locator('#chart-view').selectOption('transit');
    await page.locator('#transit-utc').fill('2026-01-01T12:00');
    await page.locator('#transit-utc').dispatchEvent('change');
    await expect
      .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
      .toBe('2026-01-01T12:00:00.000Z');
  }
  await page.evaluate(
    ({ transit, data }) => {
      if (transit) {
        window.astr3Transit!.setOptions({ layers: { natalAspects: true, crossAspects: true } });
        window.astr3Transit!.update({
          natal: data,
          transit: { bodies: data.bodies, aspects: [] },
          crossAspects: [
            {
              id: 'cross',
              type: 'trine',
              bodyRefs: [
                { chart: 'natal', id: 'moon' },
                { chart: 'transit', id: 'sun' },
              ],
            },
          ],
        });
      } else window.astr3.update(data);
    },
    { transit, data: fixture },
  );
  const root = page.locator(transit ? '#transit-chart .astr3' : '#chart .astr3');
  await expect(root).toHaveAttribute('data-layout', 'advanced');
  await expect(root.locator('.astr3-body')).toHaveCount(transit ? 6 : 3);
  return root;
}

async function clickAt(
  page: Page,
  transit: boolean,
  longitude: number,
  radius: number,
  mobile: boolean,
) {
  const stage = page.locator(`${transit ? '#transit-chart' : '#chart'} .astr3-stage`);
  await stage.scrollIntoViewIfNeeded();
  const rect = (await stage.boundingBox())!;
  const scale =
    Math.min(rect.width, rect.height) / (2 * resolveWheelGeometry('advanced', transit).extent);
  const point = polar(longitude, radius);
  const x = rect.x + rect.width / 2 + point.x * scale;
  const y = rect.y + rect.height / 2 - point.y * scale;
  if (mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

for (const transit of [false, true]) {
  const mode = transit ? 'transit' : 'natal';
  test(`picks advanced ${mode} houses, source markers, central aspects and accessible bodies`, async ({
    page,
    isMobile,
  }) => {
    const root = await ready(page, transit);
    const g = resolveWheelGeometry('advanced', transit);
    const selection = () =>
      page.evaluate(
        (transit) => (transit ? window.astr3Transit! : window.astr3).selection,
        transit,
      );
    await clickAt(page, transit, 35, 235, isMobile);
    await expect
      .poll(selection)
      .toEqual({ kind: 'house', id: 'h2', ...(transit ? { chart: 'natal' } : {}) });
    for (const side of transit ? (['natal', 'transit'] as const) : (['natal'] as const)) {
      await clickAt(page, transit, 125.5, g[side].marker, isMobile);
      await expect
        .poll(selection)
        .toEqual({ kind: 'body', id: 'moon', ...(transit ? { chart: side } : {}) });
    }
    await clickAt(page, transit, 125.5, g.anchor, isMobile);
    if (transit) {
      await expect(root.locator('.astr3-chooser button')).toHaveCount(2);
      await root.locator('.astr3-chooser button').filter({ hasText: 'Natal Moon' }).click();
    }
    await expect
      .poll(selection)
      .toEqual({ kind: 'body', id: 'moon', ...(transit ? { chart: 'natal' } : {}) });
    await clickAt(page, transit, 65.5, g.anchor / 2, isMobile);
    // In a bi-wheel the natal and cross trines share their exact endpoints.
    if (transit) {
      await expect(root.locator('.astr3-chooser button')).toHaveCount(2);
      await root.locator('.astr3-chooser button').filter({ hasText: 'Transiting Sun' }).click();
    }
    await expect.poll(selection).toEqual({
      kind: 'aspect',
      id: transit ? 'cross' : 'trine',
      ...(transit ? { chart: 'cross' } : {}),
    });
    await page.evaluate(
      (transit) =>
        (transit ? window.astr3Transit! : window.astr3).setOptions({
          layers: { aspects: false, groups: false },
        }),
      transit,
    );
    await clickAt(page, transit, 0, 0, isMobile);
    await expect.poll(selection).toBeNull();
    await root.locator('.astr3-access summary').click();
    const moon = root.locator(
      transit
        ? 'button[data-chart=natal][data-body-id=moon]'
        : 'button[data-selection="body:moon"]',
    );
    await moon.focus();
    await moon.press('Enter');
    await expect
      .poll(selection)
      .toEqual({ kind: 'body', id: 'moon', ...(transit ? { chart: 'natal' } : {}) });
  });

  test(`renders advanced ${mode} detail, themes, cusp captions and unknown houses`, async ({
    page,
  }, info) => {
    const root = await ready(page, transit);
    for (const theme of ['dark', 'light']) {
      if (theme === 'light') await page.locator('#theme-toggle').click();
      await root.screenshot({ path: info.outputPath(`advanced-${mode}-${theme}.png`) });
    }
    const stage = (await root.locator('.astr3-stage').boundingBox())!;
    const zoom = 1200 / Math.min(stage.width, stage.height);
    await page.evaluate(
      ({ transit, zoom }) => (transit ? window.astr3Transit! : window.astr3).zoomBy(zoom),
      { transit, zoom },
    );
    const sun = root.locator(
      transit
        ? '.astr3-body[data-chart=natal][data-body-id=sun]'
        : '.astr3-body[data-object="body:sun"]',
    );
    await expect(sun.locator('small')).toHaveText(/5°.*♈.*30′.*℞/);
    await expect(root.locator('.astr3-cusp').first()).toBeAttached();
    const positions = await root.locator('.astr3-cusp').evaluateAll((elements) =>
      elements.map((element) => ({
        house: Number((element as HTMLElement).dataset.house),
        text: element.textContent,
      })),
    );
    for (const position of positions) expect(position.text).toMatch(/\d+°.*[♈-♓].*\d{2}′/);
    expect(new Set(positions.map((position) => position.house)).size).toBe(positions.length);
    await page.evaluate(
      (transit) =>
        (transit ? window.astr3Transit! : window.astr3).setOptions({ layers: { degrees: false } }),
      transit,
    );
    await expect(root.locator('.astr3-cusp')).toHaveCount(0);
    await expect(sun.locator('small')).toHaveText('℞');
    await page.evaluate(
      ({ transit, data }) => {
        const unknown: ChartInput = {
          bodies: data.bodies,
          aspects: [],
          houseStatus: 'unknown',
          timeUncertain: true,
        };
        if (transit)
          window.astr3Transit!.update({
            natal: unknown,
            transit: { bodies: [] },
            crossAspects: [],
          });
        else window.astr3.update(unknown);
        const chart = transit ? window.astr3Transit! : window.astr3;
        chart.setOptions({ layers: { houses: false } });
        chart.resetView();
      },
      { transit, data: fixture },
    );
    await expect(root.locator('.astr3-axis,.astr3-cusp,[data-object^="house:"]')).toHaveCount(0);
    await clickAt(
      page,
      transit,
      125.5,
      resolveWheelGeometry('advanced', transit).anchor,
      info.project.name === 'mobile',
    );
    await expect
      .poll(() =>
        page.evaluate(
          (transit) => (transit ? window.astr3Transit! : window.astr3).selection,
          transit,
        ),
      )
      .toEqual({ kind: 'body', id: 'moon', ...(transit ? { chart: 'natal' } : {}) });
  });
}
