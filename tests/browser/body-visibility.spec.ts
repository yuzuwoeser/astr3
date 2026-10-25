import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { polar } from '../../src/layout.js';
import { resolveWheelGeometry } from '../../src/wheel-geometry.js';
import type { ChartLayout, BodyVisibility } from '../../src/types.js';
import type { TransitBodyVisibility } from '../../src/transit-renderer.js';

async function ready(page: Page) {
  await page.goto('/playground/');
  await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
  await page.locator('#body-controls summary').click();
}

async function point(page: Page, position: { x: number; y: number }, layout: ChartLayout) {
  await page.locator('#chart .astr3-stage').scrollIntoViewIfNeeded();
  const rect = (await page.locator('#chart .astr3-stage').boundingBox())!;
  const scale = Math.min(rect.width, rect.height) / (2 * resolveWheelGeometry(layout).extent);
  return {
    x: rect.x + rect.width / 2 + position.x * scale,
    y: rect.y + rect.height / 2 - position.y * scale,
  };
}

for (const layout of ['default', 'alternative'] as const) {
  test(`hides individual bodies, connectors and pick targets in the ${layout} layout`, async ({
    page,
    isMobile,
  }) => {
    await ready(page);
    await page.locator('#chart-layout').selectOption(layout);
    await page.evaluate(() =>
      window.astr3.update({
        bodies: [
          { id: 'a', name: 'A', longitude: 0 },
          { id: 'b', name: 'B', longitude: 120 },
          { id: 'c', name: 'C', longitude: 240 },
        ],
        aspects: [
          { id: 'ab', type: 'trine', bodyIds: ['a', 'b'] },
          { id: 'bc', type: 'trine', bodyIds: ['b', 'c'] },
          { id: 'ca', type: 'trine', bodyIds: ['c', 'a'] },
        ],
        groups: [
          {
            id: 'triangle',
            name: 'Triangle',
            bodyIds: ['a', 'b', 'c'],
            aspectIds: ['ab', 'bc', 'ca'],
          },
        ],
      }),
    );
    const model = await page.evaluate(() => JSON.stringify(window.astr3.model));
    const geometry = resolveWheelGeometry(layout);
    const a = polar(0, geometry.anchor),
      b = polar(120, geometry.anchor),
      c = polar(240, geometry.anchor);
    const click = async (position: { x: number; y: number }) => {
      const at = await point(page, position, layout);
      if (isMobile) await page.touchscreen.tap(at.x, at.y);
      else await page.mouse.click(at.x, at.y);
    };
    await click({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'aspect', id: 'ab' });
    await page.evaluate(() => window.astr3.select({ kind: 'body', id: 'a' }));
    const toggle = page.getByRole('checkbox', { name: 'Show Natal A', exact: true });
    await toggle.focus();
    await toggle.press('Space');
    await expect(page.locator('#chart .astr3-body[data-object="body:a"]')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(window.astr3.model))).toBe(model);
    expect(await page.evaluate(() => window.astr3.selection)).toEqual({ kind: 'body', id: 'a' });
    await expect(
      page.locator('#chart .astr3-access button[data-selection="body:a"]'),
    ).toContainText('hidden on wheel');
    for (const position of [
      a,
      polar(0, geometry.natal.marker),
      { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      { x: 0, y: 0 },
    ]) {
      await click(position);
      await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
      await expect(page.locator('#chart .astr3-chooser')).toHaveCount(0);
    }
    await click({ x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 });
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'aspect', id: 'bc' });
    await toggle.check();
    await expect(page.locator('#chart .astr3-body[data-object="body:a"]')).toHaveCount(1);
    await click({ x: 0, y: 0 });
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'group', id: 'triangle' });
  });
}

test('keeps natal and transit visibility independent through updates, layouts and animation', async ({
  page,
}) => {
  await page.clock.install();
  await ready(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('checkbox', { name: 'Show Natal Sun', exact: true }).uncheck();
  await page.locator('#chart-view').selectOption('transit');
  await page.locator('#transit-utc').fill('2024-04-08T18:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
    .toBe('2024-04-08T18:00:00.000Z');
  await expect(
    page.getByRole('checkbox', { name: 'Show Natal Sun', exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Show Transiting Sun', exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Hide all transiting bodies', exact: true }).click();
  await expect(page.locator('#transit-chart .astr3-body[data-chart=transit]')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Show Transiting Sun', exact: true }).check();
  await expect(
    page.locator('#transit-chart .astr3-body[data-chart=transit][data-body-id=sun]'),
  ).toHaveCount(1);
  await expect(
    page.locator('#transit-chart .astr3-body[data-chart=natal][data-body-id=sun]'),
  ).toHaveCount(0);
  await page.locator('#chart-layout').selectOption('alternative');
  await page.locator('#transit-animate').check();
  await page.locator('#transit-step').selectOption('week');
  await page.locator('#transit-next').click();
  await page.waitForFunction(() => window.astr3TransitAnimation!.state.status === 'playing');
  await page.getByRole('checkbox', { name: 'Show Transiting Sun', exact: true }).uncheck();
  const duration = await page.evaluate(() => window.astr3TransitAnimation!.state.durationMs);
  // Run every frame, including the first scheduled turn, regardless of renderer speed.
  await page.clock.runFor(duration + 100);
  expect(await page.evaluate(() => window.astr3TransitAnimation!.state.status)).toBe('completed');
  await expect(page.locator('#transit-chart .astr3-body[data-chart=transit]')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc))
    .toBe('2024-04-15T18:00:00.000Z');
  expect(await page.evaluate(() => window.astr3Transit!.model.transit.bodies.length)).toBe(12);
  await page.getByRole('button', { name: 'Show all transiting bodies', exact: true }).click();
  await expect(page.locator('input[data-body-chart=transit]:checked')).toHaveCount(12);
  await page.locator('#chart-view').selectOption('natal');
  await expect(
    page.getByRole('checkbox', { name: 'Show Natal Sun', exact: true }),
  ).not.toBeChecked();
  await page.locator('#preset').selectOption('j2000');
  await expect(page.locator('#calculation-status')).toContainText('Calculated locally');
  await expect(page.locator('#chart .astr3-body[data-object="body:sun"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all natal bodies', exact: true }).click();
  await expect(page.locator('#chart .astr3-body[data-object="body:sun"]')).toHaveCount(1);
});

test('validates and patches the public visibility options atomically without mutating caller records', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const modulePath = '/library.ts';
    const { createChart, createTransitChart } = (await import(
      modulePath
    )) as typeof import('../../src/index.js');
    const tick = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const bodies = [
      { id: 'a', name: 'A', longitude: 0 },
      { id: 'b', name: 'B', longitude: 120 },
    ];
    const data = { bodies, aspects: [] };
    const host = document.createElement('div');
    host.style.width = '600px';
    document.body.append(host);
    const visibility = { a: false };
    const natal = createChart(host, { data, bodyVisibility: visibility });
    visibility.a = true;
    await tick();
    const copied = natal.element.querySelectorAll('.astr3-body').length === 1;
    natal.setOptions({ bodyVisibility: { b: false, future: false } });
    await tick();
    const patched = natal.element.querySelectorAll('.astr3-body').length === 0;
    const before = JSON.stringify(natal.model);
    let invalid = false;
    try {
      natal.setOptions({
        layout: 'alternative',
        bodyVisibility: { a: 'off' } as unknown as BodyVisibility,
      });
    } catch {
      invalid = true;
    }
    const intact =
      natal.element.dataset.layout === 'default' && JSON.stringify(natal.model) === before;
    natal.update({ bodies: [{ id: 'future', name: 'Future', longitude: 240 }] });
    await tick();
    const futureHidden = natal.element.querySelectorAll('.astr3-body').length === 0;
    natal.dispose();
    const transit = createTransitChart(host, {
      data: { natal: data, transit: data },
      bodyVisibility: { natal: { a: false }, transit: { a: true } },
    });
    transit.setOptions({ bodyVisibility: { transit: { b: false } } });
    await tick();
    const sourceCounts = ['natal', 'transit'].map(
      (side) => transit.element.querySelectorAll(`.astr3-body[data-chart=${side}]`).length,
    );
    const sourceModel = JSON.stringify(transit.model);
    const invalidMasks = [null, [], { other: {} }, { natal: { a: 'off' } }, { transit: false }];
    let rejected = 0;
    for (const mask of invalidMasks) {
      try {
        transit.setOptions({
          layout: 'alternative',
          bodyVisibility: mask as unknown as TransitBodyVisibility,
        });
      } catch {
        rejected++;
      }
    }
    const sourceIntact =
      transit.element.dataset.layout === 'default' && JSON.stringify(transit.model) === sourceModel;
    transit.dispose();
    let invalidConstructors = 0;
    try {
      createChart(host, { data, bodyVisibility: { a: 0 } as unknown as BodyVisibility });
    } catch {
      invalidConstructors++;
    }
    try {
      createTransitChart(host, {
        data: { natal: data, transit: data },
        bodyVisibility: { transit: { a: null } } as unknown as TransitBodyVisibility,
      });
    } catch {
      invalidConstructors++;
    }
    const children = host.childElementCount;
    host.remove();
    return {
      copied,
      patched,
      invalid,
      intact,
      futureHidden,
      sourceCounts,
      rejected,
      sourceIntact,
      invalidConstructors,
      children,
      callerUnfrozen: !Object.isFrozen(visibility),
    };
  });
  expect(result).toEqual({
    copied: true,
    patched: true,
    invalid: true,
    intact: true,
    futureHidden: true,
    sourceCounts: [1, 1],
    rejected: 5,
    sourceIntact: true,
    invalidConstructors: 2,
    children: 0,
    callerUnfrozen: true,
  });
});

test('keeps hidden bodies accessible through graphics loss and leaves axis guides independent', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('checkbox', { name: 'Show Natal Ascendant', exact: true }).uncheck();
  await expect(page.locator('#chart .astr3-body[data-object="body:ascendant"]')).toHaveCount(0);
  await expect(page.locator('#chart .astr3-axis[data-axis=ascendant]')).toHaveCount(1);
  await expect(page.locator('#chart .astr3-axis[data-axis=ascendant]')).not.toHaveAttribute(
    'data-object',
  );
  await page.getByRole('checkbox', { name: 'Show Natal Mars', exact: true }).uncheck();
  await page.evaluate(() => {
    const gl = window.astr3.element.querySelector('canvas')!.getContext('webgl2')!;
    gl.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect.poll(() => page.evaluate(() => window.astr3.error?.code)).toBe('CONTEXT_LOST');
  const entry = page.locator('#chart .astr3-access button[data-selection="body:mars"]');
  await expect(entry).toContainText('hidden on wheel');
  await entry.click();
  await expect(page.locator('#inspector-heading')).toHaveText('Mars');
  expect(await page.evaluate(() => window.astr3.selection)).toEqual({ kind: 'body', id: 'mars' });
});
