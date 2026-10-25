import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ChartInput } from '../../src/index.js';
import { aspectPath, polar } from '../../src/layout.js';
import { resolveWheelGeometry } from '../../src/wheel-geometry.js';
import { labelPoint } from './label-point.js';

const fixture: ChartInput = {
  title: 'Synthetic layout study',
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 0 },
    { id: 'moon', name: 'Moon', longitude: 120 },
    { id: 'jupiter', name: 'Jupiter', longitude: 240 },
  ],
  houses: [350, 20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320].map((longitude, i) => ({
    id: `h${i + 1}`,
    number: i + 1,
    longitude,
  })),
  angles: { ascendant: 0, midheaven: 275 },
  aspects: [{ id: 'trine', type: 'trine', bodyIds: ['sun', 'moon'] }],
  groups: [
    {
      id: 'triangle',
      name: 'Synthetic triangle',
      bodyIds: ['sun', 'moon', 'jupiter'],
      aspectIds: [],
    },
  ],
};
async function ready(page: Page) {
  await page.goto('/playground/');
  await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
}
async function enableTransits(page: Page) {
  await page.locator('#chart-view').selectOption('transit');
  await page.locator('#transit-utc').fill('2026-01-01T12:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
    .toBe('2026-01-01T12:00:00.000Z');
}
async function screenPoint(
  page: Page,
  transit: boolean,
  longitude: number,
  radius: number,
  zoom = 1,
) {
  const host = transit ? '#transit-chart' : '#chart';
  await page.locator(`${host} .astr3-stage`).scrollIntoViewIfNeeded();
  const rect = await page.locator(`${host} .astr3-stage`).boundingBox();
  const point = polar(longitude, radius);
  const scale =
    (Math.min(rect!.width, rect!.height) /
      (2 * resolveWheelGeometry('alternative', transit).extent)) *
    zoom;
  return {
    x: rect!.x + rect!.width / 2 + point.x * scale,
    y: rect!.y + rect!.height / 2 - point.y * scale,
  };
}
async function clickAt(
  page: Page,
  transit: boolean,
  longitude: number,
  radius: number,
  mobile: boolean,
) {
  const point = await screenPoint(page, transit, longitude, radius);
  if (mobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}
async function bandViolations(page: Page, transit: boolean, zoom: number) {
  const g = resolveWheelGeometry('alternative', transit);
  return page.locator(transit ? '#transit-chart' : '#chart').evaluate(
    (root, { g, zoom }) => {
      const stage = root.querySelector('.astr3-stage')!.getBoundingClientRect();
      const scale = (Math.min(stage.width, stage.height) / (2 * g.extent)) * zoom;
      return [...root.querySelectorAll<HTMLElement>('.astr3-body,.astr3-cluster')].flatMap(
        (element) => {
          const rect = element.getBoundingClientRect();
          const x = Math.abs(rect.x + rect.width / 2 - stage.x - stage.width / 2);
          const y = Math.abs(rect.y + rect.height / 2 - stage.y - stage.height / 2);
          const near = Math.hypot(
            Math.max(0, x - rect.width / 2),
            Math.max(0, y - rect.height / 2),
          );
          const far = Math.hypot(x + rect.width / 2, y + rect.height / 2);
          const band = element.dataset.chart === 'transit' ? g.transit : g.natal;
          return near < band.inner * scale + 3.8 || far > band.outer * scale - 3.8
            ? [element.dataset.object ?? element.dataset.cluster]
            : [];
        },
      );
    },
    { g, zoom },
  );
}

test('switches layouts at runtime without changing data, selection or view and restores default placement', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate((data) => {
    window.astr3.update(data);
    window.astr3.select({ kind: 'body', id: 'sun' });
    window.astr3.zoomBy(1.25);
  }, fixture);
  const positions = () =>
    page
      .locator('#chart .astr3-body')
      .evaluateAll((elements) =>
        elements.map((element) => [
          element.getAttribute('data-object'),
          (element as HTMLElement).style.left,
          (element as HTMLElement).style.top,
        ]),
      );
  await expect(page.locator('#chart .astr3-body')).toHaveCount(3);
  const before = await positions();
  const model = await page.evaluate(() => JSON.stringify(window.astr3.model));
  await page
    .getByRole('combobox', { name: 'Chart layout', exact: true })
    .selectOption('alternative');
  await expect(page.locator('#chart .astr3')).toHaveAttribute('data-layout', 'alternative');
  const g = resolveWheelGeometry('alternative');
  const point = await screenPoint(page, false, 0, g.natal.marker, 1.25);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'body', id: 'sun' });
  expect(await page.evaluate(() => JSON.stringify(window.astr3.model))).toBe(model);
  await page.locator('#chart-layout').selectOption('default');
  await expect.poll(positions).toEqual(before);
  const stage = await page.locator('#chart .astr3-stage').boundingBox();
  const center = { x: stage!.x + stage!.width / 2, y: stage!.y + stage!.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 20, center.y + 12, { steps: 3 });
  await page.mouse.up();
  await expect.poll(positions).not.toEqual(before);
  const panned = await positions();
  await page.locator('#chart-layout').selectOption('alternative');
  await expect(page.locator('#chart .astr3')).toHaveAttribute('data-layout', 'alternative');
  await page.locator('#chart-layout').selectOption('default');
  await expect.poll(positions).toEqual(panned);
});

test('selects outer houses, ruler dots, inner anchors, aspects and group interiors', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.evaluate((data) => window.astr3.update(data), fixture);
  await page.locator('#chart-layout').selectOption('alternative');
  const g = resolveWheelGeometry('alternative');
  await clickAt(page, false, 5, g.house.label, isMobile);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'house', id: 'h1' });
  for (const radius of [g.natal.marker, g.anchor]) {
    await clickAt(page, false, 120, radius, isMobile);
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'body', id: 'moon' });
  }
  const symbol = await labelPoint(page, '#chart [data-object="body:moon"]');
  if (isMobile) await page.touchscreen.tap(symbol.x, symbol.y);
  else await page.mouse.click(symbol.x, symbol.y);
  await expect(page.locator('#inspector-heading')).toHaveText('Moon');
  // This midpoint lies on the supplied trine chord.
  await clickAt(page, false, 60, g.anchor / 2, isMobile);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'aspect', id: 'trine' });
  await clickAt(page, false, 0, 0, isMobile);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'group', id: 'triangle' });
  await page.locator('[data-layer=groups]').uncheck();
  await page.locator('[data-layer=aspects]').uncheck();
  await clickAt(page, false, 0, 0, isMobile);
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
  await page.locator('#chart .astr3-access summary').click();
  const moon = page.locator('#chart button[data-selection="body:moon"]');
  await moon.focus();
  await moon.press('Enter');
  await expect(page.locator('#inspector-heading')).toHaveText('Moon');
});

test('distinguishes source rulers and offers coincident inner anchors in transit mode', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.locator('#chart-layout').selectOption('alternative');
  await enableTransits(page);
  await expect(page.locator('#transit-chart .astr3')).toHaveAttribute('data-layout', 'alternative');
  await page.evaluate(
    (data) =>
      window.astr3Transit!.update({
        natal: { ...data, aspects: [] },
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
      }),
    fixture,
  );
  const g = resolveWheelGeometry('alternative', true);
  for (const source of ['natal', 'transit'] as const) {
    await clickAt(page, true, 0, g[source].marker, isMobile);
    await expect
      .poll(() => page.evaluate(() => window.astr3Transit!.selection))
      .toEqual({ chart: source, kind: 'body', id: 'sun' });
  }
  await clickAt(page, true, 0, g.anchor, isMobile);
  await expect(page.locator('#transit-chart .astr3-chooser button')).toHaveCount(2);
  await page
    .locator('#transit-chart .astr3-chooser button')
    .filter({ hasText: 'Natal Sun' })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ chart: 'natal', kind: 'body', id: 'sun' });
  await clickAt(page, true, 60, g.anchor / 2, isMobile);
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ chart: 'cross', kind: 'aspect', id: 'cross' });
});

test('keeps inner anchors independent of hidden or unknown houses in both chart modes', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.locator('#chart-layout').selectOption('alternative');
  for (const transit of [false, true]) {
    if (transit) await enableTransits(page);
    await page.evaluate(
      ({ transit, data }) => {
        if (transit)
          window.astr3Transit!.update({
            natal: data,
            transit: { bodies: [{ id: 'mars', name: 'Mars', longitude: 60 }], aspects: [] },
            crossAspects: [],
          });
        else window.astr3.update(data);
      },
      { transit, data: fixture },
    );
    const g = resolveWheelGeometry('alternative', transit);
    const host = transit ? '#transit-chart' : '#chart';
    const chartPositions = () =>
      page
        .locator(`${host} .astr3-body`)
        .evaluateAll((elements) =>
          elements.map((element) => [
            (element as HTMLElement).style.left,
            (element as HTMLElement).style.top,
          ]),
        );
    await expect(page.locator(`${host} .astr3-body`)).toHaveCount(transit ? 4 : 3);
    const before = await chartPositions();
    await page.locator('[data-layer=houses]').uncheck();
    await expect(page.locator(`${host} [data-object^="house:"]`)).toHaveCount(0);
    await expect.poll(chartPositions).toEqual(before);
    await clickAt(page, transit, 5, g.house.label, isMobile);
    await expect
      .poll(() =>
        page.evaluate(
          (transit) => (transit ? window.astr3Transit! : window.astr3).selection,
          transit,
        ),
      )
      .toBeNull();
    await clickAt(page, transit, 120, g.anchor, isMobile);
    await expect
      .poll(() =>
        page.evaluate(
          (transit) => (transit ? window.astr3Transit! : window.astr3).selection,
          transit,
        ),
      )
      .toEqual(
        transit ? { chart: 'natal', kind: 'body', id: 'moon' } : { kind: 'body', id: 'moon' },
      );
    await page.evaluate(
      ({ transit, data }) => {
        const unknown: ChartInput = {
          ...data,
          houses: undefined,
          angles: undefined,
          houseStatus: 'unknown',
          timeUncertain: true,
        };
        if (transit) window.astr3Transit!.update({ natal: unknown, transit: { bodies: [] } });
        else window.astr3.update(unknown);
      },
      { transit, data: fixture },
    );
    await page.locator('[data-layer=houses]').check();
    await expect(page.locator(`${host} .astr3-access button[data-kind=house]`)).toHaveCount(0);
    await expect(page.locator(`${host} .astr3-axis`)).toHaveCount(0);
    await clickAt(page, transit, 120, g.anchor, isMobile);
    await expect
      .poll(() =>
        page.evaluate(
          (transit) => (transit ? window.astr3Transit! : window.astr3).selection,
          transit,
        ),
      )
      .toEqual(
        transit ? { chart: 'natal', kind: 'body', id: 'moon' } : { kind: 'body', id: 'moon' },
      );
  }
});

test('picks conjunction bows on the alternative aspect circle and suppresses overlapping connectors', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.locator('#chart-layout').selectOption('alternative');
  const g = resolveWheelGeometry('alternative');
  const stage = await page.locator('#chart .astr3-stage').boundingBox();
  const scale = Math.min(stage!.width, stage!.height) / (2 * g.extent);
  const halfAngle = (Math.asin(24 / (2 * g.anchor * scale)) * 180) / Math.PI;
  const input: ChartInput = {
    bodies: [
      { id: 'sun', name: 'Sun', longitude: -halfAngle },
      { id: 'moon', name: 'Moon', longitude: halfAngle },
    ],
    aspects: [{ id: 'conjunction', type: 'conjunction', bodyIds: ['sun', 'moon'] }],
  };
  await page.evaluate((data) => window.astr3.update(data), input);
  await expect(page.locator('#chart .astr3-body')).toHaveCount(2);
  const path = aspectPath(polar(-halfAngle, g.anchor), polar(halfAngle, g.anchor), scale, {
    type: 'conjunction',
    markerRadii: [2.5 * Math.sqrt(1.5), 2.5 * Math.sqrt(1.5)],
    ringRadius: g.anchor,
  });
  await clickAt(page, false, 0, Math.abs(path.points[8]!.x), isMobile);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'aspect', id: 'conjunction' });
  await page.evaluate((data) => {
    window.astr3.update({
      ...data,
      bodies: data.bodies.map((body) => ({ ...body, longitude: 0 })),
    });
  }, input);
  await clickAt(page, false, 0, g.anchor - 20 / scale, isMobile);
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
  await page.locator('#chart .astr3-access summary').click();
  await page.locator('#chart button[data-selection="aspect:conjunction"]').click();
  await expect(page.locator('#inspector-heading')).toHaveText('Conjunction');
});

test('rejects invalid layouts atomically in both constructors and runtime options', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const modulePath = '/library.ts';
    const { createChart, createTransitChart } = (await import(
      modulePath
    )) as typeof import('../../src/index.js');
    const checks: boolean[] = [];
    for (const transit of [false, true]) {
      const host = document.createElement('div');
      document.body.append(host);
      try {
        if (transit)
          createTransitChart(host, {
            data: { natal: { bodies: [] }, transit: { bodies: [] } },
            layout: 'wrong' as never,
          });
        else createChart(host, { data: { bodies: [] }, layout: 'wrong' as never });
        checks.push(false);
      } catch (error) {
        checks.push(error instanceof RangeError && host.children.length === 0);
      }
      const chart = transit
        ? createTransitChart(host, {
            data: { natal: { bodies: [] }, transit: { bodies: [] } },
            layout: 'alternative',
          })
        : createChart(host, { data: { bodies: [] }, layout: 'alternative' });
      const before = chart.model;
      try {
        chart.setOptions({ layout: 'wrong' as never });
        checks.push(false);
      } catch (error) {
        checks.push(
          error instanceof RangeError &&
            chart.model === before &&
            chart.element.dataset.layout === 'alternative',
        );
      }
      chart.dispose();
      host.remove();
    }
    return checks;
  });
  expect(result).toEqual([true, true, true, true]);
});

for (const transit of [false, true]) {
  test(`contains crowded alternative ${transit ? 'transit' : 'natal'} symbols across weights and zoom`, async ({
    page,
    isMobile,
  }) => {
    await ready(page);
    await page.locator('#chart-layout').selectOption('alternative');
    if (transit) await enableTransits(page);
    await page.evaluate(
      ({ transit, data }) => {
        const bodies = Array.from({ length: 12 }, (_, i) => ({
          id: `p${i}`,
          name: `Synthetic ${i}`,
          glyph: String(i % 10),
          longitude: (350 + i) % 360,
        }));
        const natal = { ...data, bodies, aspects: [], groups: [] };
        if (transit) window.astr3Transit!.update({ natal, transit: { bodies }, crossAspects: [] });
        else window.astr3.update(natal);
      },
      { transit, data: fixture },
    );
    const host = transit ? '#transit-chart' : '#chart';
    for (const width of [isMobile ? 393 : 1280, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const weight of ['light', 'regular', 'bold']) {
        await page.locator('#chart-weight').selectOption(weight);
        for (const zoom of [1, 1.8]) {
          await page.evaluate(
            ({ transit, zoom }) => {
              const chart = transit ? window.astr3Transit! : window.astr3;
              chart.resetView();
              chart.zoomBy(zoom);
            },
            { transit, zoom },
          );
          await expect.poll(() => bandViolations(page, transit, zoom)).toEqual([]);
          await expect(page.locator(`${host} .astr3-access button[data-kind=body]`)).toHaveCount(
            transit ? 24 : 12,
          );
        }
      }
    }
    await expect(page.locator(`${host} .astr3-body,${host} .astr3-cluster`).first()).toBeVisible();
    await page.evaluate(
      (transit) =>
        transit
          ? window.astr3Transit!.select({ chart: 'natal', kind: 'body', id: 'p0' })
          : window.astr3.select({ kind: 'body', id: 'p0' }),
      transit,
    );
    await expect(page.locator('#inspector-heading')).toContainText('Synthetic 0');
  });
}

test('retains the preset through mode/time changes and renders both alternative wheels', async ({
  page,
}, info) => {
  await ready(page);
  await page.locator('#preset').selectOption('j2000');
  await expect(page.locator('#calculation-status')).toContainText('Calculated locally');
  await page.locator('#chart-layout').selectOption('alternative');
  await expect(page.locator('#chart .astr3-body').first()).toBeVisible();
  await page
    .locator('.wheel-panel')
    .screenshot({ path: `test-results/alternative-natal-${info.project.name}.png` });
  await page.locator('#chart-view').selectOption('transit');
  await page.locator('#transit-utc').fill('2026-01-01T12:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
    .toBe('2026-01-01T12:00:00.000Z');
  await expect(page.locator('#transit-chart .astr3')).toHaveAttribute('data-layout', 'alternative');
  await page
    .locator('.wheel-panel')
    .screenshot({ path: `test-results/alternative-transit-${info.project.name}.png` });
  await page.locator('#chart-view').selectOption('natal');
  await expect(page.locator('#chart .astr3')).toHaveAttribute('data-layout', 'alternative');
  await page.locator('#chart-layout').selectOption('default');
  await page.locator('#chart-view').selectOption('transit');
  await expect(page.locator('#transit-chart .astr3')).toHaveAttribute('data-layout', 'default');
});
