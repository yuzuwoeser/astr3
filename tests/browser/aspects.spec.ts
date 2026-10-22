import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ASPECT_DEFINITIONS } from '../../src/model/index.js';
import type { AspectType } from '../../src/model/index.js';
import { WHEEL, polar } from '../../src/layout.js';
import { labelPoint } from './label-point.js';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
  await expect(page.locator('[data-aspect-enabled]')).toHaveCount(11);
}

async function aspectPoint(page: Page, longitude: number) {
  const a = polar(0, WHEEL.house),
    b = polar(longitude, WHEEL.house);
  return page.evaluate(
    ({ x, y, extent }) => {
      const stage = document.querySelector('#chart .astr3-stage')!;
      let rect = stage.getBoundingClientRect();
      const scale = Math.min(rect.width, rect.height) / (2 * extent);
      window.scrollBy({
        top: rect.y + rect.height / 2 - y * scale - innerHeight / 2,
        behavior: 'instant',
      });
      rect = stage.getBoundingClientRect();
      return { x: rect.x + rect.width / 2 + x * scale, y: rect.y + rect.height / 2 - y * scale };
    },
    { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, extent: WHEEL.extent },
  );
}

test('switches supplied aspects and patterns with keyboard controls and keeps body markers usable', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await expect(page.locator('[data-aspect-enabled]:checked')).toHaveCount(5);
  await expect(page.locator('[data-orb=quincunx]')).toBeDisabled();
  await expect(page.locator('#aspect-legend [data-aspect-type]')).toHaveCount(5);
  await page.locator('#select-pattern').click();
  const trine = page.locator('[data-aspect-enabled=trine]');
  await trine.focus();
  await trine.press('Space');
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
  expect(await page.evaluate(() => window.astr3.model.groups)).toEqual([]);
  expect(
    await page.evaluate(() => window.astr3.model.aspects.some((a) => a.type === 'trine')),
  ).toBe(false);
  await expect(page.locator('#chart .astr3-access [data-kind=group]')).toHaveCount(0);
  await expect(page.locator('#aspect-legend [data-aspect-type=trine]')).toHaveCount(0);
  await trine.check();
  await expect(page.locator('#chart .astr3-access [data-kind=group]')).toHaveCount(1);
  await page.locator('[data-aspect-preset=all]').click();
  await expect(page.locator('[data-aspect-enabled]:checked')).toHaveCount(11);
  expect(
    await page.evaluate(() => window.astr3.model.aspects.some((a) => a.type === 'quincunx')),
  ).toBe(true);
  await expect(
    page.locator('#chart .astr3-access [data-kind=aspect]').filter({ hasText: 'Quincunx' }).first(),
  ).toBeAttached();
  await page.locator('[data-aspect-preset=none]').click();
  await expect(page.locator('[data-aspect-enabled]:checked')).toHaveCount(0);
  expect(await page.evaluate(() => window.astr3.model.aspects)).toEqual([]);
  await expect(page.locator('#chart .astr3-access [data-kind=aspect]')).toHaveCount(0);
  await expect(page.locator('#aspect-legend')).toContainText('No enabled aspects');
  const at = await labelPoint(page, '#chart .astr3-body[data-object="body:sun"]');
  if (isMobile) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
  await expect(page.locator('#inspector-heading')).toHaveText('Sun');
  await expect(page.locator('#details')).not.toContainText('Aspect geometry');
  await page.locator('[data-aspect-preset=major]').click();
  await expect(page.locator('[data-aspect-enabled]:checked')).toHaveCount(5);
  await expect(page.locator('#details')).toContainText('Aspect geometry');
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'body', id: 'sun' });
});

test('selects every new aspect on the wheel and removes its pick target when disabled', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const types: AspectType[] = [
    'semisextile',
    'semisquare',
    'quintile',
    'sesquiquadrate',
    'biquintile',
    'quincunx',
  ];
  for (const type of types) {
    const { name, angle } = ASPECT_DEFINITIONS[type];
    await page.evaluate(
      ({ type, angle }) =>
        window.astr3.update({
          bodies: [
            { id: 'sun', name: 'Sun', longitude: 0 },
            { id: 'moon', name: 'Moon', longitude: angle },
          ],
          aspects: [{ id: 'minor', type, bodyIds: ['sun', 'moon'] }],
        }),
      { type, angle },
    );
    await page.locator(`[data-aspect-enabled=${type}]`).check();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const at = await aspectPoint(page, angle);
    if (isMobile) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'aspect', id: 'minor' });
    await expect(page.locator('#inspector-heading')).toHaveText(name);
    await expect(page.locator('#details')).toContainText(`${angle}°`);
    await page.locator(`[data-aspect-enabled=${type}]`).uncheck();
    await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
    await expect(page.locator('#chart .astr3-access [data-kind=aspect]')).toHaveCount(0);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const former = await aspectPoint(page, angle);
    if (isMobile) await page.touchscreen.tap(former.x, former.y);
    else await page.mouse.click(former.x, former.y);
    await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
  }
  expect(errors).toEqual([]);
});

test('retains disabled orbs and patches options atomically without resetting other aspect switches', async ({
  page,
}) => {
  await ready(page);
  const quincunx = page.locator('[data-aspect-enabled=quincunx]');
  const orb = page.locator('[data-orb=quincunx]');
  await quincunx.check();
  await orb.fill('1.5');
  await orb.dispatchEvent('change');
  await quincunx.uncheck();
  await expect(orb).toBeDisabled();
  await expect(orb).toHaveValue('1.5');
  await quincunx.check();
  await expect(orb).toHaveValue('1.5');
  const result = await page.evaluate(() => {
    const chart = window.astr3;
    chart.update({
      bodies: [
        { id: 'a', name: 'A', longitude: 0 },
        { id: 'b', name: 'B', longitude: 30 },
        { id: 'c', name: 'C', longitude: 150 },
      ],
    });
    chart.setOptions({ enabledAspects: { semisextile: true } });
    chart.select({ kind: 'body', id: 'a' });
    const before = chart.model;
    let rejected = false;
    try {
      chart.setOptions({ enabledAspects: { quincunx: 'yes' as unknown as boolean } });
    } catch {
      rejected = true;
    }
    return {
      rejected,
      unchanged: before === chart.model,
      selection: chart.selection,
      types: chart.model.aspects.map((a) => a.type),
    };
  });
  expect(result).toMatchObject({
    rejected: true,
    unchanged: true,
    selection: { kind: 'body', id: 'a' },
  });
  expect(result.types).toEqual(expect.arrayContaining(['semisextile', 'quincunx']));
});

test('configures transit families independently and retains minor selections through time and view updates', async ({
  page,
}) => {
  await ready(page);
  await page.locator('#preset').selectOption('j2000');
  await expect(page.locator('#calculation-status')).toContainText('Calculated locally');
  await page.locator('#chart-view').selectOption('transit');
  await page.locator('#transit-utc').fill('2024-04-08T18:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
    .toBe('2024-04-08T18:00:00.000Z');
  await page.evaluate(() =>
    window.astr3Transit!.update({
      natal: {
        bodies: [
          { id: 'a', name: 'A', longitude: 0 },
          { id: 'b', name: 'B', longitude: 30 },
        ],
      },
      transit: {
        bodies: [
          { id: 'a', name: 'A', longitude: 150 },
          { id: 'b', name: 'B', longitude: 180 },
        ],
      },
    }),
  );
  await page.locator('[data-aspect-enabled=quincunx]').check();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.astr3Transit!.model.crossAspects.filter((a) => a.type === 'quincunx').length,
      ),
    )
    .toBe(2);
  await page.locator('#transit-chart .astr3-access summary').click();
  const cross = page
    .locator('#transit-chart .astr3-access [data-kind=aspect]')
    .filter({ hasText: 'Quincunx' })
    .first();
  await cross.focus();
  await cross.press('Enter');
  await expect(page.locator('#inspector-heading')).toHaveText('Transit-to-natal Quincunx');
  await page.locator('#orb-family').selectOption('natal');
  await expect(page.locator('[data-aspect-enabled=quincunx]')).not.toBeChecked();
  await page.locator('[data-aspect-enabled=semisextile]').check();
  await page.locator('[data-orb=semisextile]').fill('0.5');
  await page.locator('[data-orb=semisextile]').dispatchEvent('change');
  await expect(page.locator('#aspect-legend [data-aspect-type=semisextile]')).toHaveCount(0);
  await page.locator('[data-transit-layer=natalAspects]').check();
  await expect(page.locator('#aspect-legend [data-aspect-type=semisextile]')).toHaveCount(1);
  await page.locator('#orb-family').selectOption('transit');
  await expect(page.locator('[data-aspect-enabled=semisextile]')).not.toBeChecked();
  await page.locator('[data-aspect-enabled=semisextile]').check();
  await page.locator('#orb-family').selectOption('cross');
  await page.locator('[data-aspect-preset=none]').click();
  await expect.poll(() => page.evaluate(() => window.astr3Transit!.selection)).toBeNull();
  expect(
    await page.evaluate(() => ({
      cross: window.astr3Transit!.model.crossAspects.length,
      natal: window.astr3Transit!.model.natal.aspects.map((a) => a.type),
      transit: window.astr3Transit!.model.transit.aspects.map((a) => a.type),
    })),
  ).toEqual({ cross: 0, natal: ['semisextile'], transit: ['semisextile'] });
  await expect(page.locator('#aspect-legend [data-aspect-type=quincunx]')).toHaveCount(0);
  await page.locator('[data-aspect-enabled=quincunx]').check();
  const preserved = await page.evaluate(() => {
    const chart = window.astr3Transit!;
    const natal = chart.model.natal;
    const id = natal.aspects[0]!.id;
    chart.select({ kind: 'aspect', chart: 'natal', id });
    chart.setOptions({ enabledAspects: { cross: { semisextile: true } } });
    const patched = chart.model.crossAspects.filter((a) => a.type === 'quincunx').length === 2;
    const unchanged = chart.model.natal;
    chart.updateTransit({
      bodies: chart.model.transit.bodies.map((body) => ({
        ...body,
        longitude: body.longitude + 1,
      })),
    });
    return {
      patched,
      natal: unchanged === chart.model.natal,
      selection: chart.selection?.id === id,
    };
  });
  expect(preserved).toEqual({ patched: true, natal: true, selection: true });
  await page.locator('#chart-view').selectOption('natal');
  await expect(page.locator('[data-aspect-enabled=semisextile]')).toBeChecked();
  await expect(page.locator('[data-orb=semisextile]')).toHaveValue('0.5');
  await page.locator('#chart-view').selectOption('transit');
  await expect(page.locator('[data-aspect-enabled=quincunx]')).toBeChecked();
  await page.locator('#transit-next').click();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata?.utc))
    .toBe('2024-04-09T18:00:00.000Z');
  await expect(page.locator('[data-aspect-enabled=quincunx]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.astr3Transit!.selection?.chart)).toBe('natal');
});
