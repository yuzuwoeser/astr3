import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { formatPosition } from '../../src/model/math.js';
import { labelPoint } from './label-point.js';

async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#chart-view').selectOption('transit');
  await page.locator('#transit-utc').fill('2024-04-08T18:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
    .toBe('2024-04-08T18:00:00.000Z');
}

for (const layout of ['default', 'alternative']) {
  test(`animates exact times with synchronized selection, labels and pause/resume in ${layout} layout`, async ({
    page,
  }) => {
    await ready(page);
    await page.locator('#chart-layout').selectOption(layout);
    const trace = await page.evaluateHandle(() => {
      const chart = window.astr3Transit!;
      chart.select({ chart: 'transit', kind: 'body', id: 'mars' });
      chart.zoomBy(1.1);
      const trace = { times: [] as string[], natal: chart.model.natal, keptNatal: true, views: 0 };
      chart.on('view', () => trace.views++);
      window.astr3TransitAnimation!.on('progress', ({ state }) => {
        trace.times.push(state.currentTime!);
        trace.keptNatal &&= chart.model.natal === trace.natal;
      });
      return trace;
    });
    await page.locator('#transit-animate').check();
    await page.locator('#transit-step').selectOption('week');
    await page.locator('#transit-next').click();
    await page.waitForFunction(() => window.astr3TransitAnimation?.state.status === 'playing');
    await page.locator('#transit-pause').click();
    await expect(page.locator('#transit-pause')).toHaveText('Resume');
    const paused = await page.evaluate(() => window.astr3TransitAnimation!.state.currentTime);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.astr3TransitAnimation!.state.currentTime)).toBe(paused);
    expect(await page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc)).toBe(
      paused,
    );
    const position = await page.evaluate(
      () => window.astr3Transit!.model.transit.bodies.find((body) => body.id === 'mars')!.longitude,
    );
    await expect(
      page.locator('#transit-chart .astr3-access button[data-chart=transit][data-body-id=mars]'),
    ).toContainText(formatPosition(position));
    // Picking must follow the currently displayed geometry, even mid-transition.
    const selector = '#transit-chart .astr3-body[data-chart=transit][data-body-id=mars]';
    if (await page.locator(selector).count()) {
      const at = await labelPoint(page, selector);
      await page.mouse.click(at.x, at.y);
    } else {
      await page
        .locator('#transit-chart')
        .getByRole('button', { name: /clustered bodies:.*Mars/ })
        .click();
    }
    const chooser = page.locator('#transit-chart .astr3-chooser button');
    if (await chooser.count()) await chooser.filter({ hasText: 'Mars' }).click();
    await expect(page.locator('#inspector-heading')).toHaveText('Transiting Mars');
    await page.locator('#transit-pause').click();
    await expect
      .poll(() => page.evaluate(() => window.astr3TransitAnimation!.state.status))
      .toBe('completed');
    await expect(page.locator('#transit-utc')).toHaveValue('2024-04-15T18:00');
    const summary = await trace.evaluate((trace) => ({
      times: trace.times,
      keptNatal: trace.keptNatal,
      views: trace.views,
    }));
    expect(summary.keptNatal).toBe(true);
    expect(summary.views).toBe(0);
    expect(summary.times.length).toBeGreaterThan(30);
    expect(summary.times[0]).toBe('2024-04-08T18:00:00.000Z');
    expect(summary.times.at(-1)).toBe('2024-04-15T18:00:00.000Z');
    const gaps = summary.times
      .slice(1)
      .map((time, i) => new Date(time).getTime() - new Date(summary.times[i]!).getTime());
    expect(Math.max(...gaps)).toBeLessThanOrEqual(6 * 3_600_000);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.astr3Transit!.selection)).toEqual({
      chart: 'transit',
      kind: 'body',
      id: 'mars',
    });
    await trace.dispose();
  });
}

test('finishes at the endpoint when animation is disabled and keeps direct date/Now updates immediate', async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator('#transit-animate')).not.toBeChecked();
  await page.locator('#transit-animate').check();
  await page.locator('#transit-step').selectOption('year');
  await page.locator('#transit-next').click();
  await expect(page.locator('#transit-pause')).toBeVisible();
  await page.locator('#transit-animate').uncheck();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc))
    .toBe('2025-04-08T18:00:00.000Z');
  await expect(page.locator('#transit-pause')).toBeHidden();
  await page.locator('#transit-animate').check();
  await page.locator('#transit-prev').click();
  await page.locator('#transit-utc').fill('2024-02-29T12:15');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc))
    .toBe('2024-02-29T12:15:00.000Z');
  expect(await page.evaluate(() => window.astr3TransitAnimation!.state.status)).toBe('idle');
  await page.locator('#transit-now').click();
  await expect
    .poll(async () =>
      Math.abs(
        new Date(
          await page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc as string),
        ).getTime() - Date.now(),
      ),
    )
    .toBeLessThan(120000);
});

test('resizes and switches chart modes without resize-observer delivery errors', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const errors: string[] = [];
    Object.defineProperty(window, 'astr3ResizeErrors', { value: errors });
    window.addEventListener('error', (event) => {
      if (event.message.includes('ResizeObserver')) errors.push(event.message);
    });
  });
  await ready(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.locator('#chart-view').selectOption('natal');
  await page.locator('#chart-view').selectOption('transit');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { astr3ResizeErrors: string[] }).astr3ResizeErrors,
    ),
  ).toEqual([]);
});

test('keeps fractional seconds when disabling a partially completed step', async ({ page }) => {
  await ready(page);
  await page.locator('#transit-animate').check();
  await page.evaluate(() => {
    void window.astr3TransitAnimation!.play({
      from: '2024-04-08T18:00:23.456Z',
      to: '2024-04-09T18:00:23.456Z',
    });
  });
  await page.waitForFunction(() => {
    const animation = window.astr3TransitAnimation!;
    if (animation.state.status !== 'playing') return false;
    animation.pause();
    return true;
  });
  await page.locator('#transit-animate').uncheck();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc))
    .toBe('2024-04-09T18:00:23.456Z');
});

test('disposes chart resources even when an application disposal listener throws', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const modulePath = '/library.ts';
    const { createChart, createTransitChart, createTransitAnimation } = (await import(
      modulePath
    )) as typeof import('../../src/index.js');
    const result = [];
    for (const transit of [false, true]) {
      const host = document.createElement('div');
      document.body.append(host);
      const data = { bodies: [] };
      const chart = transit
        ? createTransitChart(host, { data: { natal: data, transit: data } })
        : createChart(host, { data });
      let calls = 0;
      chart.on('dispose', () => {
        calls++;
        throw new Error('Application listener failed');
      });
      const animation = transit
        ? createTransitAnimation(
            chart as import('../../src/index.js').TransitChart,
            async () => data,
          )
        : undefined;
      let message = '';
      try {
        chart.dispose();
      } catch (error) {
        message = (error as Error).message;
      }
      chart.dispose();
      result.push({
        calls,
        message,
        roots: host.childElementCount,
        companionDisposed: !animation || animation.state.status === 'disposed',
      });
      host.remove();
    }
    return result;
  });
  expect(result).toEqual(
    Array.from({ length: 2 }, () => ({
      calls: 1,
      message: 'Application listener failed',
      roots: 0,
      companionDisposed: true,
    })),
  );
});

test('cancels when leaving transit mode and disposes with the chart', async ({ page }) => {
  await ready(page);
  await page.locator('#transit-animate').check();
  await page.locator('#transit-step').selectOption('month');
  await page.locator('#transit-next').click();
  await page.locator('#chart-view').selectOption('natal');
  const time = await page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc)).toBe(time);
  expect(await page.evaluate(() => window.astr3TransitAnimation!.state.status)).toBe('idle');
  await page.evaluate(() => window.astr3Transit!.dispose());
  expect(await page.evaluate(() => window.astr3TransitAnimation!.state.status)).toBe('disposed');
});

test('honors reduced motion and clamps year steps on leap day', async ({ page }) => {
  await ready(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#transit-utc').fill('2024-02-29T12:15');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc))
    .toBe('2024-02-29T12:15:00.000Z');
  await page.locator('#transit-animate').check();
  await page.locator('#transit-step').selectOption('year');
  await page.locator('#transit-next').click();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc))
    .toBe('2025-02-28T12:15:00.000Z');
  expect(await page.evaluate(() => window.astr3TransitAnimation!.state)).toMatchObject({
    status: 'completed',
    durationMs: 0,
  });
  await page.locator('#transit-prev').click();
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.model.transit.metadata!.utc))
    .toBe('2024-02-28T12:15:00.000Z');
});

test('fails atomically and retains accessible selection without WebGL', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const modulePath = '/library.ts';
    const { createTransitAnimation } = (await import(
      modulePath
    )) as typeof import('../../src/index.js');
    const chart = window.astr3Transit!;
    chart.select({ chart: 'transit', kind: 'body', id: 'mars' });
    const gl = chart.element.querySelector('canvas')!.getContext('webgl2')!;
    gl.getExtension('WEBGL_lose_context')!.loseContext();
    const before = chart.model;
    const animation = createTransitAnimation(chart, async () => ({
      bodies: [{ id: 'bad', name: 'Bad', longitude: NaN }],
    }));
    let failed = false;
    try {
      await animation.play({ from: '2024-04-08T18:00Z', to: '2024-04-09T18:00Z' });
    } catch {
      failed = true;
    }
    const result = { failed, intact: chart.model === before, status: animation.state.status };
    animation.dispose();
    return result;
  });
  expect(result).toEqual({ failed: true, intact: true, status: 'error' });
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit!.error?.code))
    .toBe('CONTEXT_LOST');
  await page
    .locator('#transit-chart .astr3-access button[data-chart=transit][data-body-id=mars]')
    .click();
  await expect(page.locator('#inspector-heading')).toHaveText('Transiting Mars');
});
