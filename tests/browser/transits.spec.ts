import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TRANSIT_WHEEL } from '../../src/renderer.js';
import { WHEEL, aspectPath, polar } from '../../src/layout.js';
import { labelPoint } from './label-point.js';

async function ready(page: Page) {
  await page.goto('/');
  await page.locator('#preset').selectOption('j2000');
  await expect(page.locator('#calculation-status')).toContainText('Calculated locally');
  await page.locator('#chart-view').selectOption('transit');
  await page.locator('#transit-utc').fill('2024-04-08T18:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
    .toBe('2024-04-08T18:00:00.000Z');
  await expect(page.locator('#transit-chart .astr3')).toHaveAttribute('data-mode', 'transit');
}
async function screenPoint(page: Page, longitude: number, radius: number, ascendant = 0) {
  await page.locator('#transit-chart .astr3-stage').scrollIntoViewIfNeeded();
  const rect = await page.locator('#transit-chart .astr3-stage').boundingBox();
  const world = polar(longitude, radius, ascendant),
    scale = Math.min(rect!.width, rect!.height) / (2 * TRANSIT_WHEEL.extent);
  return {
    x: rect!.x + rect!.width / 2 + world.x * scale,
    y: rect!.y + rect!.height / 2 - world.y * scale,
  };
}

test('selects natal angles and transiting lunar nodes with source-qualified details', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await expect(page.locator('#transit-chart .astr3-access button[data-kind=body]')).toHaveCount(26);
  for (const id of ['ascendant', 'midheaven']) {
    const point = await labelPoint(page, `#transit-chart .astr3-axis[data-axis=${id}]`);
    if (isMobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await expect
      .poll(() => page.evaluate(() => window.astr3Transit!.selection))
      .toEqual({
        chart: 'natal',
        kind: 'body',
        id,
      });
    await expect(page.locator('#details')).not.toContainText('Motion');
  }
  const { longitude, ascendant } = await page.evaluate(() => ({
    longitude: window.astr3Transit!.model.transit.bodies.find((body) => body.id === 'north-node')!
      .longitude,
    ascendant: window.astr3Transit!.model.natal.angles.ascendant!,
  }));
  for (const radius of [TRANSIT_WHEEL.marker, WHEEL.house]) {
    const point = await screenPoint(page, longitude, radius, ascendant);
    if (isMobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    const chooser = page.locator('#transit-chart .astr3-chooser button');
    if (await chooser.count()) await chooser.filter({ hasText: 'Transiting North Node' }).click();
    await expect
      .poll(() => page.evaluate(() => window.astr3Transit!.selection))
      .toEqual({
        chart: 'transit',
        kind: 'body',
        id: 'north-node',
      });
    await expect(page.locator('#inspector-heading')).toHaveText('Transiting North Node');
    await expect(page.locator('#details')).toContainText('True (osculating)');
    await expect(page.locator('#details')).toContainText('Natal house');
  }
  expect(
    await page.evaluate(() =>
      window.astr3Transit!.model.transit.bodies.some((body) =>
        ['ascendant', 'midheaven'].includes(body.id),
      ),
    ),
  ).toBe(false);
});

test('selects independently scoped planets from the outer band and accessible list', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await page.evaluate(() =>
    window.astr3Transit!.update({
      natal: { bodies: [{ id: 'mars', name: 'Mars', longitude: 0 }] },
      transit: { bodies: [{ id: 'mars', name: 'Mars', longitude: 60 }] },
    }),
  );
  await expect(page.locator('#transit-chart .astr3-access button[data-kind=body]')).toHaveCount(2);
  const p = await screenPoint(page, 60, TRANSIT_WHEEL.marker);
  if (isMobile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ kind: 'body', chart: 'transit', id: 'mars' });
  await expect(page.locator('#inspector-heading')).toHaveText('Transiting Mars');
  await page.locator('#transit-chart .astr3-access summary').click();
  const natal = page.locator('#transit-chart button[data-chart=natal][data-body-id=mars]');
  await natal.focus();
  await natal.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ kind: 'body', chart: 'natal', id: 'mars' });
  await expect(page.locator('#inspector-heading')).toHaveText('Natal Mars');
  for (const family of ['natalAspects', 'transitAspects'])
    await page.locator(`[data-transit-layer=${family}]`).check();
  await page.locator('[data-transit-layer=crossAspects]').uncheck();
  await page.locator('#chart-weight').selectOption('bold');
  await page.locator('#theme-toggle').click();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ kind: 'body', chart: 'natal', id: 'mars' });
  expect(errors).toEqual([]);
});

test('shares house-ring anchors and aspect geometry across all three families', async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => {
    const bodies = [
      { id: 'sun', name: 'Sun', longitude: 0 },
      { id: 'moon', name: 'Moon', longitude: 120 },
    ];
    window.astr3Transit!.update({
      natal: { bodies, aspects: [{ id: 'n', type: 'trine', bodyIds: ['sun', 'moon'] }] },
      transit: { bodies, aspects: [{ id: 't', type: 'trine', bodyIds: ['sun', 'moon'] }] },
      crossAspects: [
        {
          id: 'c',
          type: 'trine',
          bodyRefs: [
            { chart: 'natal', id: 'sun' },
            { chart: 'transit', id: 'moon' },
          ],
        },
      ],
    });
    window.astr3Transit!.setOptions({
      layers: { natalAspects: true, transitAspects: true, crossAspects: true },
    });
  });
  await expect(page.locator('#transit-chart .astr3-access button[data-kind=body]')).toHaveCount(4);
  const anchor = await screenPoint(page, 0, WHEEL.house);
  await page.mouse.click(anchor.x, anchor.y);
  await expect(page.locator('#transit-chart .astr3-chooser button')).toHaveCount(2);
  await expect(page.locator('#transit-chart .astr3-chooser')).toContainText('Natal Sun');
  await expect(page.locator('#transit-chart .astr3-chooser')).toContainText('Transiting Sun');
  await page
    .locator('#transit-chart .astr3-chooser button')
    .filter({ hasText: 'Transiting Sun' })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ chart: 'transit', kind: 'body', id: 'sun' });
  // All three chords must coincide, not just look close on a narrow screen.
  const midpoint = await screenPoint(page, 60, WHEEL.house / 2);
  await page.mouse.click(midpoint.x, midpoint.y);
  await expect(page.locator('#transit-chart .astr3-chooser button')).toHaveCount(3);
});

test('uses distance-aware conjunction bows and overlap suppression in all three families', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.locator('#transit-chart .astr3-stage').scrollIntoViewIfNeeded();
  const stage = await page.locator('#transit-chart .astr3-stage').boundingBox();
  const scale = Math.min(stage!.width, stage!.height) / (2 * TRANSIT_WHEEL.extent);
  const halfAngle = (Math.asin(24 / (2 * WHEEL.house * scale)) * 180) / Math.PI;
  const update = async (halfAngle: number) =>
    page.evaluate((halfAngle) => {
      const bodies = [
        { id: 'sun', name: 'Sun', longitude: -halfAngle },
        { id: 'moon', name: 'Moon', longitude: halfAngle },
      ];
      window.astr3Transit!.update({
        natal: { bodies, aspects: [{ id: 'n', type: 'conjunction', bodyIds: ['sun', 'moon'] }] },
        transit: { bodies, aspects: [{ id: 't', type: 'conjunction', bodyIds: ['sun', 'moon'] }] },
        crossAspects: [
          {
            id: 'c',
            type: 'conjunction',
            bodyRefs: [
              { chart: 'natal', id: 'sun' },
              { chart: 'transit', id: 'moon' },
            ],
          },
        ],
      });
    }, halfAngle);
  await update(halfAngle);
  await expect(page.locator('#transit-chart .astr3-access button[data-kind=body]')).toHaveCount(4);
  const natalRadius = 2.5 * Math.sqrt(1.5),
    transitRadius = natalRadius + (1.1 * 1.5) / 2;
  for (const [chart, id, radii] of [
    ['natal', 'n', [natalRadius, natalRadius]],
    ['transit', 't', [transitRadius, transitRadius]],
    ['cross', 'c', [natalRadius, transitRadius]],
  ] as const) {
    await page.evaluate(
      (family) =>
        new Promise<void>((resolve) => {
          window.astr3Transit!.setOptions({
            layers: {
              natalAspects: family === 'natal',
              transitAspects: family === 'transit',
              crossAspects: family === 'cross',
            },
          });
          requestAnimationFrame(() => resolve());
        }),
      chart,
    );
    const path = aspectPath(polar(-halfAngle, WHEEL.house), polar(halfAngle, WHEEL.house), scale, {
      type: 'conjunction',
      markerRadii: radii,
      ringRadius: WHEEL.house,
    });
    const at = await screenPoint(page, 0, -path.points[8]!.x);
    if (isMobile) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await expect
      .poll(() => page.evaluate(() => window.astr3Transit!.selection))
      .toEqual({
        kind: 'aspect',
        chart,
        id,
      });
  }
  await update(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.astr3Transit!.setOptions({
          layers: { natalAspects: true, crossAspects: true, transitAspects: true },
        });
        window.astr3Transit!.select({ chart: 'cross', kind: 'aspect', id: 'c' });
        requestAnimationFrame(() => resolve());
      }),
  );
  const formerLoop = await screenPoint(page, 0, WHEEL.house - 15 / scale);
  if (isMobile) await page.touchscreen.tap(formerLoop.x, formerLoop.y);
  else await page.mouse.click(formerLoop.x, formerLoop.y);
  await expect.poll(() => page.evaluate(() => window.astr3Transit!.selection)).toBeNull();
  const anchor = await screenPoint(page, 0, WHEEL.house);
  if (isMobile) await page.touchscreen.tap(anchor.x, anchor.y);
  else await page.mouse.click(anchor.x, anchor.y);
  await expect(page.locator('#transit-chart .astr3-chooser button')).toHaveCount(4);
  await page
    .locator('#transit-chart .astr3-chooser button')
    .filter({ hasText: 'Transiting Moon' })
    .click();
  await page.locator('#transit-chart .astr3-access summary').click();
  const cross = page
    .locator('#transit-chart .astr3-access button[data-kind=aspect]')
    .filter({ hasText: 'Natal Sun / Transiting Moon' });
  await cross.focus();
  await cross.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ chart: 'cross', kind: 'aspect', id: 'c' });
});

test('pins transits outside a two-sided zodiac scale without separate transit circles', async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() =>
    window.astr3Transit!.update({
      natal: { bodies: [{ id: 'sun', name: 'Sun', longitude: 180 }] },
      transit: { bodies: [{ id: 'mars', name: 'Mars', longitude: 60 }] },
      crossAspects: [],
    }),
  );
  await expect(page.locator('#transit-chart .astr3-degree[data-scale=inside]')).toHaveCount(36);
  await expect(page.locator('#transit-chart .astr3-degree[data-scale=outside]')).toHaveCount(36);
  const natalMarker = await screenPoint(page, 180, WHEEL.zodiacInner);
  await page.mouse.click(natalMarker.x, natalMarker.y);
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ chart: 'natal', kind: 'body', id: 'sun' });
  const marker = await screenPoint(page, 60, WHEEL.outer);
  await page.mouse.click(marker.x, marker.y);
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.selection))
    .toEqual({ chart: 'transit', kind: 'body', id: 'mars' });
  await expect
    .poll(() =>
      page.evaluate((extent) => {
        // Query the current label and stage together: selecting schedules a redraw.
        const stage = document
          .querySelector('#transit-chart .astr3-stage')!
          .getBoundingClientRect();
        const label = document
          .querySelector('#transit-chart .astr3-body[data-chart=transit][data-body-id=mars]')!
          .getBoundingClientRect();
        return (
          Math.hypot(
            label.x + label.width / 2 - stage.x - stage.width / 2,
            label.y + label.height / 2 - stage.y - stage.height / 2,
          ) /
          (Math.min(stage.width, stage.height) / (2 * extent))
        );
      }, TRANSIT_WHEEL.extent),
    )
    .toBeLessThan(360);
  const pixels = await page.evaluate(async () => {
    const chart = window.astr3Transit!;
    chart.update({ natal: { bodies: [] }, transit: { bodies: [] } });
    chart.setOptions({
      layers: {
        zodiac: false,
        degrees: false,
        houses: false,
        axes: false,
        groups: false,
        aspects: false,
      },
    });
    return new Promise<{ background: number[]; painted: number }>((resolve) =>
      requestAnimationFrame(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('#transit-chart canvas')!;
        const gl = canvas.getContext('webgl2')!;
        const values = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, values);
        let painted = 0;
        for (let i = 0; i < values.length; i += 4)
          if (values[i] !== values[0] || values[i + 1] !== values[1] || values[i + 2] !== values[2])
            painted++;
        resolve({ background: [...values.slice(0, 3)], painted });
      }),
    );
  });
  expect(pixels).toEqual({ background: [17, 28, 32], painted: 0 });
  await expect(page.locator('#transit-chart .astr3-degree')).toHaveCount(0);
  await page.locator('#chart-view').selectOption('natal');
  await expect(page.locator('#chart .astr3-degree[data-scale=inside]')).toHaveCount(36);
  await expect
    .poll(() => page.locator('#chart .astr3-degree[data-scale=outside]').count())
    .toBeGreaterThan(25);
});

test('customizes three independent orb families and retains them across view switches', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.astr3Transit!.update({
      natal: {
        bodies: [
          { id: 'a', name: 'A', longitude: 0 },
          { id: 'b', name: 'B', longitude: 91 },
        ],
      },
      transit: {
        bodies: [
          { id: 'a', name: 'A', longitude: 98 },
          { id: 'b', name: 'B', longitude: 7 },
        ],
      },
    }),
  );
  const counts = () =>
    page.evaluate(() => ({
      natal: window.astr3Transit!.model.natal.aspects.length,
      transit: window.astr3Transit!.model.transit.aspects.length,
      cross: window.astr3Transit!.model.crossAspects.length,
    }));
  const before = await counts();
  await page.locator('#orb-family').selectOption('cross');
  await page.locator('[data-orb=conjunction]').fill('2');
  await page.locator('[data-orb=conjunction]').dispatchEvent('change');
  await expect.poll(async () => (await counts()).cross).toBeLessThan(before.cross);
  expect((await counts()).natal).toBe(before.natal);
  expect((await counts()).transit).toBe(before.transit);
  await page.locator('#orb-family').selectOption('natal');
  await page.locator('[data-orb=square]').fill('0.5');
  await page.locator('[data-orb=square]').dispatchEvent('change');
  await expect.poll(async () => (await counts()).natal).toBe(0);
  expect((await counts()).transit).toBe(1);
  await page.locator('#orb-family').selectOption('cross');
  await expect(page.locator('[data-orb=conjunction]')).toHaveValue('2');
  const valid = await counts();
  await page.locator('[data-orb=conjunction]').fill('-1');
  await page.locator('[data-orb=conjunction]').dispatchEvent('change');
  await expect(page.locator('#orb-status')).toContainText('0° to 180°');
  expect(await counts()).toEqual(valid);
  await page.locator('#chart-view').selectOption('natal');
  await page.locator('#chart-view').selectOption('transit');
  await expect(page.locator('[data-orb=conjunction]')).toHaveValue('2');
});

test('updates transits atomically without moving natal data, camera, or stable selections', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const chart = window.astr3Transit!;
    chart.select({ kind: 'body', chart: 'transit', id: 'mars' });
    chart.zoomBy(1.2);
    const natal = chart.model.natal;
    const selection = chart.selection;
    let views = 0;
    chart.on('view', () => views++);
    chart.updateTransit({ bodies: [{ id: 'mars', name: 'Mars', longitude: 99 }] });
    const keptNatal = chart.model.natal === natal;
    const keptSelection = JSON.stringify(chart.selection) === JSON.stringify(selection);
    const model = JSON.stringify(chart.model);
    let invalid = false;
    try {
      chart.updateTransit({ bodies: [{ id: 'mars', name: 'Mars', longitude: NaN }] });
    } catch {
      invalid = true;
    }
    let weightRejected = false;
    try {
      chart.setOptions({ chartWeight: 'invalid' as 'bold' });
    } catch {
      weightRejected = true;
    }
    const intact = JSON.stringify(chart.model) === model;
    chart.update({
      natal: { bodies: [{ id: 'sun', name: 'Sun', longitude: 0 }] },
      transit: { bodies: [{ id: 'sun', name: 'Sun', longitude: 120 }] },
    });
    const aspect = chart.model.crossAspects[0]!;
    chart.select({ kind: 'aspect', chart: 'cross', id: aspect.id });
    chart.updateTransit({ bodies: [{ id: 'sun', name: 'Sun', longitude: 121 }] });
    const keptAspect = chart.selection?.id === aspect.id;
    chart.updateTransit({ bodies: [{ id: 'sun', name: 'Sun', longitude: 145 }] });
    const clearedAspect = chart.selection === null;
    chart.updateTransit({ bodies: [] });
    return {
      keptNatal,
      keptSelection,
      views,
      invalid,
      weightRejected,
      intact,
      keptAspect,
      clearedAspect,
      cleared: chart.selection,
    };
  });
  expect(result).toEqual({
    keptNatal: true,
    keptSelection: true,
    views: 0,
    invalid: true,
    weightRejected: true,
    intact: true,
    keptAspect: true,
    clearedAspect: true,
    cleared: null,
  });
});

test('steps UTC and applies only the latest time while preserving the previous chart on failure', async ({
  page,
}) => {
  await ready(page);
  const natal = await page.evaluate(() => JSON.stringify(window.astr3Transit!.model.natal));
  await page.locator('#transit-utc').fill('2024-01-31T12:15');
  await page.locator('#transit-utc').dispatchEvent('change');
  await page.locator('#transit-step').selectOption('month');
  await page.locator('#transit-next').click();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata?.utc))
    .toBe('2024-02-29T12:15:00.000Z');
  expect(await page.evaluate(() => JSON.stringify(window.astr3Transit!.model.natal))).toBe(natal);
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#transit-utc')!;
    for (const value of ['2024-04-01T00:00', '2024-05-01T00:00', '2024-06-01T00:00']) {
      input.value = value;
      input.dispatchEvent(new Event('change'));
    }
  });
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata?.utc))
    .toBe('2024-06-01T00:00:00.000Z');
  await page.locator('#transit-utc').fill('2101-01-01T00:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect(page.locator('#transit-status')).toContainText('1900 through 2100');
  expect(await page.evaluate(() => window.astr3Transit!.model.transit.metadata?.utc)).toBe(
    '2024-06-01T00:00:00.000Z',
  );
  await page.locator('#transit-now').click();
  await expect
    .poll(async () =>
      Math.abs(
        new Date(
          (await page.evaluate(() => window.astr3Transit!.model.transit.metadata?.utc)) as string,
        ).getTime() - Date.now(),
      ),
    )
    .toBeLessThan(120000);
});

test('shrinks crowded natal symbols independently of the transit band', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await ready(page);
  await page.evaluate(() =>
    window.astr3Transit!.update({
      natal: {
        bodies: Array.from({ length: 6 }, (_, i) => ({
          id: `point-${i}`,
          name: `Point ${i}`,
          longitude: (359 + i / 10) % 360,
          glyph: '☉',
          retrograde: i % 2 === 0,
        })),
        aspects: [],
      },
      transit: { bodies: [{ id: 'venus', name: 'Venus', longitude: 180 }], aspects: [] },
      crossAspects: [],
    }),
  );
  await expect(page.locator('#transit-chart .astr3-access button[data-kind=body]')).toHaveCount(7);
  const sizes = () =>
    page.evaluate(() => {
      const font = (selector: string) =>
        Math.max(
          ...[...document.querySelectorAll(selector)].map((element) =>
            parseFloat(getComputedStyle(element).fontSize),
          ),
        );
      return {
        natal: font('#transit-chart .astr3-body[data-chart=natal]'),
        transit: font('#transit-chart .astr3-body[data-chart=transit]'),
      };
    });
  await expect.poll(async () => (await sizes()).transit).toBe(24);
  await expect.poll(async () => (await sizes()).natal).toBeLessThan(24);
  expect((await sizes()).natal).toBeGreaterThanOrEqual(14);
  const at = await labelPoint(
    page,
    '#transit-chart .astr3-body[data-chart=transit][data-body-id=venus]',
  );
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('#inspector-heading')).toHaveText('Transiting Venus');
  await page.evaluate(() =>
    window.astr3Transit!.update({
      natal: { bodies: window.astr3Transit!.model.natal.bodies.slice(0, 1), aspects: [] },
      transit: { bodies: window.astr3Transit!.model.transit.bodies, aspects: [] },
      crossAspects: [],
    }),
  );
  await expect.poll(sizes).toEqual({ natal: 24, transit: 24 });
  expect(await page.evaluate(() => window.astr3Transit!.selection)).toEqual({
    chart: 'transit',
    kind: 'body',
    id: 'venus',
  });
});

test('contains both label bands and retains accessible selections through graphics loss', async ({
  page,
}, info) => {
  await ready(page);
  await page.locator('#transit-chart .astr3-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#transit-chart .astr3-access button[data-kind=body]')).toHaveCount(26);
  const violations = () =>
    page.evaluate(
      ({ extent, inner, outer }) => {
        const rect = document.querySelector('#transit-chart .astr3-stage')!.getBoundingClientRect();
        const scale = Math.min(rect.width, rect.height) / (2 * extent);
        return [...document.querySelectorAll<HTMLElement>('#transit-chart .astr3-body')]
          .filter((el) => {
            const b = el.getBoundingClientRect(),
              x = Math.abs(b.x + b.width / 2 - rect.x - rect.width / 2),
              y = Math.abs(b.y + b.height / 2 - rect.y - rect.height / 2);
            const near = Math.hypot(Math.max(0, x - b.width / 2), Math.max(0, y - b.height / 2)),
              far = Math.hypot(x + b.width / 2, y + b.height / 2);
            return (
              near < (el.dataset.chart === 'transit' ? inner : 148) * scale + 3.8 ||
              far > (el.dataset.chart === 'transit' ? outer : 242) * scale - 3.8
            );
          })
          .map((el) => el.dataset.object);
      },
      { extent: TRANSIT_WHEEL.extent, inner: TRANSIT_WHEEL.inner, outer: TRANSIT_WHEEL.outer },
    );
  await expect.poll(violations).toEqual([]);
  const houseCollisions = await page
    .locator('#transit-chart [data-object^="house:"]')
    .evaluateAll((labels) => {
      const boxes = labels.map((label) => label.getBoundingClientRect());
      return boxes.flatMap((a, i) =>
        boxes
          .slice(i + 1)
          .filter(
            (b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
          ),
      ).length;
    });
  expect(houseCollisions).toBe(0);
  await page
    .locator('.wheel-panel')
    .screenshot({ path: `test-results/transit-${info.project.name}.png` });
  await page.evaluate(() => {
    const gl = document
      .querySelector<HTMLCanvasElement>('#transit-chart canvas')!
      .getContext('webgl2')!;
    (window as unknown as { transitGL: WEBGL_lose_context }).transitGL =
      gl.getExtension('WEBGL_lose_context')!;
    (window as unknown as { transitGL: WEBGL_lose_context }).transitGL.loseContext();
  });
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.error?.code))
    .toBe('CONTEXT_LOST');
  await page.locator('#transit-chart button[data-chart=transit][data-body-id=mars]').click();
  await expect(page.locator('#inspector-heading')).toHaveText('Transiting Mars');
  await page.evaluate(() =>
    (window as unknown as { transitGL: WEBGL_lose_context }).transitGL.restoreContext(),
  );
  await expect.poll(() => page.evaluate(() => window.astr3Transit!.error)).toBeNull();
  expect(WHEEL.house).toBe(148);
});
