import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ChartInput } from '../../src/index.js';
import { polar } from '../../src/layout.js';
import { resolveWheelGeometry } from '../../src/wheel-geometry.js';
import { labelPoint } from './label-point.js';

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
  await expect(root.locator('.astr3-access button[data-kind=body]')).toHaveCount(transit ? 6 : 3);
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
  test(`aligns advanced ${mode} symbols and captions along selectable radial hands`, async ({
    page,
    isMobile,
  }, info) => {
    await page.setViewportSize({ width: 2600, height: 2700 });
    await ready(page, transit);
    await page.evaluate(
      async ({ transit, data }) => {
        const modulePath = '/library.ts';
        const { createChart, createTransitChart } = (await import(
          modulePath
        )) as typeof import('../../src/index.js');
        const host = document.createElement('div');
        host.id = 'radial-fixture';
        host.style.cssText =
          'position:absolute;left:0;top:0;width:2400px;z-index:100;background:#111c20';
        document.body.append(host);
        const bodies = [
          ...data.bodies,
          { id: 'north-node', name: 'North Node', longitude: 65.5 },
          { id: 'custom', name: 'Custom point', glyph: 'CP', longitude: 185.5 },
          { id: 'ascendant', name: 'Ascendant', longitude: 0 },
          { id: 'midheaven', name: 'Midheaven', longitude: 270 },
        ];
        const natal = { ...data, bodies, aspects: [] };
        if (transit)
          window.astr3Transit = createTransitChart(host, {
            data: { natal, transit: { bodies }, crossAspects: [] },
            layout: 'advanced',
          });
        else window.astr3 = createChart(host, { data: natal, layout: 'advanced' });
      },
      { transit, data: fixture },
    );
    const root = page.locator('#radial-fixture .astr3');
    await expect(root.locator('.astr3-body')).toHaveCount(transit ? 14 : 7);
    const errors = await root.evaluate((root) => {
      const stage = root.querySelector('.astr3-stage')!.getBoundingClientRect();
      const center = { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
      return [...root.querySelectorAll<HTMLElement>('.astr3-body')].flatMap((element) => {
        const symbol = element.querySelector('.astr3-symbol')!.getBoundingClientRect();
        const caption = element.querySelector('small')!.getBoundingClientRect();
        const x = caption.x + caption.width / 2 - symbol.x - symbol.width / 2;
        const y = caption.y + caption.height / 2 - symbol.y - symbol.height / 2;
        const rect = element.getBoundingClientRect();
        const radialX = rect.x + rect.width / 2 - center.x;
        const radialY = rect.y + rect.height / 2 - center.y;
        const rotation = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        const offset = Math.abs(x * radialY - y * radialX) / Math.hypot(radialX, radialY);
        const inward = x * radialX + y * radialY;
        const orientation = Math.abs(rotation.a * radialY - rotation.b * radialX);
        let previousEnd = -Infinity;
        const upright = [...element.querySelectorAll<HTMLElement>('.astr3-character')].every(
          (character) => {
            const counter = new DOMMatrixReadOnly(getComputedStyle(character).transform);
            const net = rotation.multiply(counter);
            const rect = character.getBoundingClientRect();
            const x =
              rect.x +
              rect.width / 2 -
              element.getBoundingClientRect().x -
              element.getBoundingClientRect().width / 2;
            const y =
              rect.y +
              rect.height / 2 -
              element.getBoundingClientRect().y -
              element.getBoundingClientRect().height / 2;
            const offset = Math.abs(x * rotation.b - y * rotation.a);
            const along = x * rotation.a + y * rotation.b;
            const half =
              (rect.width * Math.abs(rotation.a) + rect.height * Math.abs(rotation.b)) / 2;
            const separate = along - half >= previousEnd - 0.1;
            previousEnd = along + half;
            return (
              Math.abs(net.a - 1) < 1e-5 &&
              Math.abs(net.b) < 1e-5 &&
              Math.abs(net.c) < 1e-5 &&
              Math.abs(net.d - 1) < 1e-5 &&
              offset < 0.1 &&
              separate
            );
          },
        );
        // CSS layout quantizes label centers to fractions of a pixel.
        return offset > 0.1 || inward >= 0 || orientation > 0.1 || !upright
          ? [{ id: element.dataset.object, offset, inward, orientation, upright }]
          : [];
      });
    });
    expect(errors).toEqual([]);
    expect(
      await root.locator('.astr3-labels > .astr3-symbol').evaluateAll((elements) =>
        elements.every((element) => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
          return matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1;
        }),
      ),
    ).toBe(true);
    const moon = transit
      ? '#radial-fixture .astr3-body[data-chart=natal][data-body-id=moon]'
      : '#radial-fixture .astr3-body[data-object="body:moon"]';
    for (const part of ['.astr3-symbol', 'small']) {
      const { x, y } = await labelPoint(page, `${moon} ${part}`);
      if (isMobile) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await expect
        .poll(() =>
          page.evaluate(
            (transit) => (transit ? window.astr3Transit! : window.astr3).selection,
            transit,
          ),
        )
        .toEqual({ kind: 'body', id: 'moon', ...(transit ? { chart: 'natal' } : {}) });
      await page.evaluate(
        (transit) => (transit ? window.astr3Transit! : window.astr3).clearSelection(),
        transit,
      );
    }
    await root
      .locator('.astr3-stage')
      .screenshot({ path: info.outputPath(`advanced-${mode}-radial.png`) });
    const exported = await page.evaluate(async (transit) => {
      const svg = await (transit ? window.astr3Transit! : window.astr3).exportSvg({ size: 2400 });
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden';
      holder.innerHTML = svg;
      document.body.append(holder);
      try {
        const rows = [...holder.querySelectorAll<SVGGElement>('g[opacity][transform^="rotate("]')];
        const toWheel = holder.querySelector('svg')!.getCTM()!.inverse();
        return {
          count: rows.length,
          errors: rows.flatMap((row) => {
            const runs = [...row.querySelectorAll<SVGGElement>(':scope > g[fill]')];
            if (runs.length !== 2) return [{ count: runs.length, offset: 0, gap: 0 }];
            const baseline = row.transform.baseVal.consolidate()!.matrix;
            const center = row.querySelector('rect')!;
            const point = new DOMPoint(
              center.x.baseVal.value + center.width.baseVal.value / 2,
              center.y.baseVal.value + center.height.baseVal.value / 2,
            ).matrixTransform(baseline);
            const upright = runs.every((run) =>
              [...run.querySelectorAll<SVGGElement>(':scope > g')].every((character) => {
                if (!character.querySelector('path')) return true;
                const matrix = toWheel.multiply(character.getCTM()!);
                const box = character.getBBox();
                const position = new DOMPoint(
                  box.x + box.width / 2,
                  box.y + box.height / 2,
                ).matrixTransform(matrix);
                const offset = Math.abs(
                  (position.x - point.x) * baseline.b - (position.y - point.y) * baseline.a,
                );
                return (
                  Math.abs(matrix.a - 1) < 1e-5 &&
                  Math.abs(matrix.b) < 1e-5 &&
                  Math.abs(matrix.c) < 1e-5 &&
                  Math.abs(matrix.d - 1) < 1e-5 &&
                  offset < 0.25
                );
              }),
            );
            return upright ? [] : [{ count: runs.length, offset: 1, gap: 0 }];
          }),
        };
      } finally {
        holder.remove();
      }
    }, transit);
    expect(exported).toEqual({ count: transit ? 14 : 7, errors: [] });
    await page.evaluate(
      (transit) => (transit ? window.astr3Transit! : window.astr3).dispose(),
      transit,
    );
  });

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
    await expect(sun.locator('small')).toHaveText(/5°.*♈.*30′.*℞/);
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
