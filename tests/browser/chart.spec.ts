import { syntheticNatal } from '../fixtures/synthetic-chart.js';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { WHEEL, aspectPath, polar } from '../../src/layout.js';
import type { Point } from '../../src/layout.js';
import type { Selection } from '../../src/index.js';
import { labelPoint } from './label-point.js';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('.astr3-body')).toHaveCount(14);
  await expect.poll(() => page.evaluate(() => window.astr3.error)).toBeNull();
}

async function simpleChart(page: Page) {
  await page.evaluate(() =>
    window.astr3.update({
      title: 'Interaction fixture',
      bodies: [
        { id: 'sun', name: 'Sun', longitude: 0 },
        { id: 'moon', name: 'Moon', longitude: 120 },
        { id: 'jupiter', name: 'Jupiter', longitude: 240 },
      ],
      aspects: [
        { id: 'a', type: 'trine', bodyIds: ['sun', 'moon'] },
        { id: 'b', type: 'trine', bodyIds: ['moon', 'jupiter'] },
        { id: 'c', type: 'trine', bodyIds: ['jupiter', 'sun'] },
      ],
      groups: [
        {
          id: 'triangle',
          name: 'Test triangle',
          bodyIds: ['sun', 'moon', 'jupiter'],
          aspectIds: ['a', 'b', 'c'],
        },
      ],
    }),
  );
  await expect(page.locator('.astr3-body')).toHaveCount(3);
}
async function point(page: Page, x: number, y: number) {
  await page.locator('.astr3-stage').scrollIntoViewIfNeeded();
  const stage = await page.locator('.astr3-stage').boundingBox();
  if (!stage) throw new Error('Missing stage');
  const scale = Math.min(stage.width, stage.height) / 660;
  return { x: stage.x + stage.width / 2 + x * scale, y: stage.y + stage.height / 2 - y * scale };
}
async function selectAt(page: Page, x: number, y: number) {
  const p = await point(page, x, y);
  await page.mouse.click(p.x, p.y);
}

async function anchorPixels(page: Page, points: Point[], selection: Selection | null) {
  return page.evaluate(
    ({ points, selection, extent }) => {
      window.astr3.select(selection);
      return new Promise<number[][]>((resolve) =>
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('.astr3 canvas')!;
          const stage = document.querySelector('.astr3-stage')!.getBoundingClientRect();
          const scale = Math.min(stage.width, stage.height) / (2 * extent);
          const gl = canvas.getContext('webgl2')!;
          resolve(
            points.map((point) => {
              const x = ((stage.width / 2 + point.x * scale) * canvas.width) / stage.width;
              const y = ((stage.height / 2 + point.y * scale) * canvas.height) / stage.height;
              const pixel = new Uint8Array(4);
              gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
              return [...pixel].slice(0, 3);
            }),
          );
        }),
      );
    },
    { points, selection, extent: WHEEL.extent },
  );
}

async function planetBandViolations(page: Page, zoom = 1) {
  return page.evaluate(
    ({ house, outer, extent, zoom }) => {
      const stage = document.querySelector('.astr3-stage')!.getBoundingClientRect();
      const scale = (Math.min(stage.width, stage.height) / (2 * extent)) * zoom;
      const cx = stage.x + stage.width / 2,
        cy = stage.y + stage.height / 2;
      return [...document.querySelectorAll<HTMLElement>('.astr3-body')].flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const x = Math.abs(rect.x + rect.width / 2 - cx),
          y = Math.abs(rect.y + rect.height / 2 - cy);
        const near = Math.hypot(Math.max(0, x - rect.width / 2), Math.max(0, y - rect.height / 2));
        const far = Math.hypot(x + rect.width / 2, y + rect.height / 2);
        return near < house * scale + 3.9 || far > outer * scale - 3.9
          ? [element.dataset.object]
          : [];
      });
    },
    { house: WHEEL.house, outer: WHEEL.labelOuter, extent: WHEEL.extent, zoom },
  );
}

async function syntheticNatalChart(page: Page) {
  await page.evaluate((data) => window.astr3.update(data), syntheticNatal);
  await expect
    .poll(() => page.evaluate(() => window.astr3.model.title))
    .toBe('Synthetic clustered chart');
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

async function publicReferenceChart(page: Page) {
  await page.locator('#preset').selectOption('custom');
  await page.locator('#utc').fill('2000-01-01T12:00');
  await page.locator('#latitude').fill('51.5074');
  await page.locator('#longitude').fill('-0.1278');
  await page.locator('#calculate').click();
  await expect(page.locator('#chart-caption')).toContainText('2000-01-01 12:00:00 UTC');
  await expect(page.locator('#calculation-status')).toContainText('Calculated locally');
  await expect(page.locator('.astr3-access button[data-selection="body:mercury"]')).toContainText(
    '1°53',
  );
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

test('selects angles and lunar nodes through glyphs, axes, anchors, and keyboard controls', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await publicReferenceChart(page);
  const names = {
    ascendant: 'Ascendant',
    midheaven: 'Midheaven',
    'north-node': 'North Node',
    'south-node': 'South Node',
  };
  for (const [id, name] of Object.entries(names)) {
    const point = await labelPoint(page, `.astr3-body[data-object="body:${id}"]`);
    if (isMobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await expect(page.locator('#inspector-heading')).toHaveText(name);
    if (id.includes('node'))
      await expect(page.locator('#details')).toContainText('True (osculating)');
    else await expect(page.locator('#details')).not.toContainText('Motion');
  }
  for (const id of ['ascendant', 'midheaven']) {
    const point = await labelPoint(page, `.astr3-axis[data-axis=${id}]`);
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'body', id });
    const anchor = await page.evaluate((id) => {
      const model = window.astr3.model;
      return {
        longitude: model.bodies.find((body) => body.id === id)!.longitude,
        asc: model.angles.ascendant!,
      };
    }, id);
    await page.evaluate(() => window.astr3.clearSelection());
    const world = polar(anchor.longitude, WHEEL.house, anchor.asc);
    await selectAt(page, world.x, world.y);
    const chooser = page.locator('.astr3-chooser button');
    if (await chooser.count())
      await chooser.filter({ hasText: names[id as keyof typeof names] }).click();
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'body', id });
  }
  await page.evaluate(() => window.astr3.setOptions({ layers: { axes: false } }));
  await expect(page.locator('.astr3-axis')).toHaveCount(0);
  await expect(page.locator('.astr3-body')).toHaveCount(14);
  await page.locator('.astr3-access summary').click();
  const node = page.locator('.astr3-access button[data-selection="body:north-node"]');
  await node.focus();
  await node.press('Enter');
  await expect(page.locator('#inspector-heading')).toHaveText('North Node');
  await page.locator('#preset').selectOption('unknown');
  await expect.poll(() => page.evaluate(() => window.astr3.model.timeUncertain)).toBe(true);
  await expect(page.locator('.astr3-access button[data-kind=body]')).toHaveCount(12);
  expect(
    await page.evaluate(() => window.astr3.model.bodies.some((body) => body.id === 'ascendant')),
  ).toBe(false);
});

test('renders a real WebGL wheel and selects a planet with contextual highlighting', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await page.screenshot({ path: `test-results/${info.project.name}-overview.png`, fullPage: true });
  await page.locator('[data-object="body:sun"]').scrollIntoViewIfNeeded();
  const box = await page.locator('[data-object="body:sun"]').boundingBox();
  if (!box) throw new Error('No Sun label');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'body', id: 'sun' });
  await expect(page.locator('#inspector-heading')).toHaveText('Sun');
  await expect(page.locator('[data-object="body:sun"]')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('.astr3-body[data-dim=true]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
  expect(errors).toEqual([]);
});

test('selects aspect lines with invisible tolerance, group interiors, and the background', async ({
  page,
}) => {
  await ready(page);
  await simpleChart(page);
  // Offset the midpoint of the Sun/Moon chord by a few screen pixels.
  const p = await point(page, -WHEEL.house / 4, (-WHEEL.house * Math.sqrt(3)) / 4);
  await page.mouse.click(p.x + 2, p.y - 2);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'aspect', id: 'a' });
  await expect(page.locator('#details')).toContainText('0.000°');
  await selectAt(page, 0, 0);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'group', id: 'triangle' });
  await expect(page.locator('#inspector-heading')).toHaveText('Test triangle');
  await selectAt(page, 310, 310);
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
});

test('offers a chooser for overlapping aspects instead of arbitrarily selecting one', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.astr3.update({
      bodies: [
        { id: 'a', name: 'A', longitude: 0 },
        { id: 'b', name: 'B', longitude: 120 },
      ],
      aspects: [
        { id: 'first', type: 'trine', bodyIds: ['a', 'b'] },
        { id: 'second', type: 'trine', bodyIds: ['a', 'b'] },
      ],
    }),
  );
  await expect(page.locator('.astr3-body')).toHaveCount(2);
  await selectAt(page, -WHEEL.house / 4, (-WHEEL.house * Math.sqrt(3)) / 4);
  await expect(page.getByRole('group', { name: 'Overlapping chart objects' })).toBeVisible();
  await page.locator('.astr3-chooser button').nth(1).click();
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'aspect', id: 'second' });
});

test('renders every planet anchor and links its selection and highlighting to the aspect network', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.astr3.update({
      bodies: [
        { id: 'sun', name: 'Sun', longitude: 0 },
        { id: 'moon', name: 'Moon', longitude: 120 },
        { id: 'pluto', name: 'Pluto', longitude: 240 },
      ],
      aspects: [{ id: 'trine', type: 'trine', bodyIds: ['sun', 'moon'] }],
    }),
  );
  await expect(page.locator('.astr3-body')).toHaveCount(3);
  await page.mouse.move(0, 0);
  const anchors = [0, 120, 240].map((longitude) => polar(longitude, WHEEL.house));
  const pixels = await anchorPixels(page, anchors, null);
  for (const pixel of pixels)
    pixel.forEach((value, channel) => expect(value).toBeCloseTo([233, 237, 229][channel]!, -1));
  const highlighted = await anchorPixels(page, anchors, { kind: 'aspect', id: 'trine' });
  for (const pixel of highlighted.slice(0, 2))
    pixel.forEach((value, channel) => expect(value).toBeCloseTo([234, 203, 146][channel]!, -1));
  expect(highlighted[2]!.every((value, i) => value < pixels[2]![i]!)).toBe(true);
  await expect(page.locator('[data-object="body:sun"]')).toHaveCSS('color', 'rgb(234, 203, 146)');
  await expect(page.locator('[data-object="body:moon"]')).toHaveCSS('color', 'rgb(234, 203, 146)');
  // This planet has no aspects, so its dot also proves the anchors are independent.
  const p = await point(page, anchors[2]!.x, anchors[2]!.y);
  if (isMobile) await page.touchscreen.tap(p.x, p.y);
  else {
    await page.mouse.move(p.x, p.y);
    await expect(page.locator('#tooltip')).toContainText('Pluto');
    await page.mouse.click(p.x, p.y);
  }
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'body', id: 'pluto' });
  await expect(page.locator('#inspector-heading')).toHaveText('Pluto');
  await expect(page.locator('[data-object="body:pluto"]')).toHaveAttribute('data-active', 'true');
  // Bodies keep their anchors with the aspects layer disabled, even without houses.
  await page.locator('input[data-layer=aspects]').uncheck();
  await page.evaluate(() => window.astr3.clearSelection());
  const sun = await point(page, anchors[0]!.x, anchors[0]!.y);
  if (isMobile) await page.touchscreen.tap(sun.x + 8, sun.y);
  else await page.mouse.click(sun.x + 5, sun.y);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'body', id: 'sun' });
  // Hiding bodies removes their hit targets as well as the drawn dots.
  await page.evaluate(() => window.astr3.setOptions({ layers: { bodies: false } }));
  await expect(page.locator('.astr3-body')).toHaveCount(0);
  await selectAt(page, anchors[0]!.x, anchors[0]!.y);
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
});

test('suppresses coincident conjunction curves while retaining dots and aspect inspection', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.astr3.update({
      bodies: [
        { id: 'sun', name: 'Sun', longitude: 0 },
        { id: 'moon', name: 'Moon', longitude: 0 },
      ],
      aspects: [{ id: 'conjunction', type: 'conjunction', bodyIds: ['sun', 'moon'] }],
    }),
  );
  await expect(page.locator('.astr3-body')).toHaveCount(2);
  const anchor = await point(page, -WHEEL.house, 0);
  if (isMobile) await page.touchscreen.tap(anchor.x, anchor.y);
  else await page.mouse.click(anchor.x, anchor.y);
  await expect(page.getByRole('group', { name: 'Overlapping chart objects' })).toBeVisible();
  await expect(page.locator('.astr3-chooser button')).toHaveCount(2);
  await page.locator('.astr3-chooser button').filter({ hasText: 'Moon' }).click();
  await expect(page.locator('#inspector-heading')).toHaveText('Moon');
  const stage = await page.locator('.astr3-stage').boundingBox();
  const scale = Math.min(stage!.width, stage!.height) / (2 * WHEEL.extent);
  const formerLoop = { x: -WHEEL.house + 15 / scale, y: 0 };
  const inside = await point(page, formerLoop.x, formerLoop.y);
  if (isMobile) await page.touchscreen.tap(inside.x, inside.y);
  else await page.mouse.click(inside.x, inside.y);
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
  await page.locator('.astr3-access summary').click();
  const aspect = page.locator('.astr3-access button[data-selection="aspect:conjunction"]');
  await aspect.focus();
  await aspect.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'aspect', id: 'conjunction' });
  await expect(page.locator('#inspector-heading')).toHaveText('conjunction');
  // Selecting a hidden aspect highlights its endpoints without restoring a loop.
  const pixels = await anchorPixels(page, [formerLoop], { kind: 'aspect', id: 'conjunction' });
  expect(pixels[0]).toEqual([17, 28, 32]);
  for (const id of ['sun', 'moon'])
    await expect(page.locator(`.astr3-body[data-object="body:${id}"]`)).toHaveCSS(
      'color',
      'rgb(234, 203, 146)',
    );
  await page.locator('.astr3-access summary').click();
  // Zoom/pan must project the anchor targets with the camera, just like the lines.
  await page.evaluate(() => window.astr3.zoomBy(1.25));
  await expect(page.locator('.astr3-body')).toHaveCount(2);
  const zoomed = await point(page, -WHEEL.house * 1.25, 0);
  const center = await point(page, 0, 0);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 28, center.y + 20, { steps: 3 });
  await page.mouse.up();
  await page.mouse.click(zoomed.x + 28, zoomed.y + 20);
  await expect(page.getByRole('group', { name: 'Overlapping chart objects' })).toBeVisible();
  await expect(page.locator('.astr3-chooser button')).toHaveCount(2);
});

test('picks visible conjunction bows, excludes faint paths, and keeps geometry stable across orb edits', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.locator('.astr3-stage').scrollIntoViewIfNeeded();
  const stage = await page.locator('.astr3-stage').boundingBox();
  const scale = Math.min(stage!.width, stage!.height) / (2 * WHEEL.extent);
  const radius = 2.5 * Math.sqrt(1.5); // Demo's Regular weight, in CSS pixels.
  const overlap = 2 * radius + 2;
  for (const distance of [overlap + 1, overlap + 3, 24]) {
    const halfAngle = (Math.asin(distance / (2 * WHEEL.house * scale)) * 180) / Math.PI;
    await page.evaluate((halfAngle) => {
      window.astr3.update({
        bodies: [
          { id: 'sun', name: 'Sun', longitude: -halfAngle },
          { id: 'moon', name: 'Moon', longitude: halfAngle },
        ],
      });
      window.astr3.setOptions({ orbs: { conjunction: 45 } });
    }, halfAngle);
    const path = aspectPath(polar(-halfAngle, WHEEL.house), polar(halfAngle, WHEEL.house), scale, {
      type: 'conjunction',
      markerRadii: [radius, radius],
      ringRadius: WHEEL.house,
    });
    const middle = path.points[8]!;
    // Sampling waits for the updated frame as well as checking actual WebGL ink.
    const before = await anchorPixels(page, [middle], null);
    expect(before[0]!.some((value, i) => value !== [17, 28, 32][i])).toBe(true);
    const at = await point(page, middle.x, middle.y);
    if (isMobile) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    const id = await page.evaluate(() => window.astr3.model.aspects[0]!.id);
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual(distance < overlap + 2 ? null : { kind: 'aspect', id });
    await page.evaluate(() => window.astr3.setOptions({ orbs: { conjunction: 60 } }));
    expect(await anchorPixels(page, [middle], null)).toEqual(before);
    expect(await page.evaluate(() => window.astr3.model.aspects[0]!.id)).toBe(id);
  }
});

test('selects houses directly and from a keyboard-accessible list', async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    window.astr3.update({
      bodies: [{ id: 'sun', name: 'Sun', longitude: 15 }],
      aspects: [],
      houses: Array.from({ length: 12 }, (_, i) => ({
        id: `house-${i + 1}`,
        number: i + 1,
        longitude: i * 30,
      })),
    }),
  );
  await expect(page.locator('.astr3-body')).toHaveCount(1);
  const houseLabel = page.locator('[data-object="house:house-1"]');
  await houseLabel.scrollIntoViewIfNeeded();
  const houseBox = await houseLabel.boundingBox();
  await page.mouse.click(houseBox!.x + houseBox!.width / 2, houseBox!.y + houseBox!.height / 2);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'house', id: 'house-1' });
  await page.locator('.astr3-access summary').click();
  const button = page.locator('.astr3-access button').first();
  await button.focus();
  await button.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'body', id: 'sun' });
  await button.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({ kind: 'house', id: 'house-1' });
  await expect(page.locator('.astr3-sr')).toContainText('Selected House 1');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.astr3.selection)).toBeNull();
});

test('updates atomically, preserves stable selection, and clears missing objects', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const chart = window.astr3;
    chart.select({ kind: 'body', id: 'sun' });
    chart.update({ bodies: [{ id: 'sun', name: 'Sun', longitude: 30 }] });
    const preserved = chart.selection;
    let rejected = false;
    try {
      chart.update({ bodies: [{ id: 'bad', name: 'Bad', longitude: NaN }] });
    } catch {
      rejected = true;
    }
    const afterInvalid = chart.model.bodies[0]?.longitude;
    chart.update({ bodies: [] });
    return { preserved, rejected, afterInvalid, cleared: chart.selection };
  });
  expect(result).toEqual({
    preserved: { kind: 'body', id: 'sun' },
    rejected: true,
    afterInvalid: 30,
    cleared: null,
  });
});

test('supports zoom, pan, reset, themes, and layers without drag selecting', async ({ page }) => {
  await ready(page);
  const label = page.locator('[data-object="body:sun"]');
  const before = await label.boundingBox();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(async () => (await label.boundingBox())?.x).not.toBe(before?.x);
  const p = await point(page, 0, 0);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 30, p.y + 25, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.astr3.selection)).toBeNull();
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect
    .poll(async () => Math.round((await label.boundingBox())!.x))
    .toBe(Math.round(before!.x));
  await page.getByRole('button', { name: 'Switch to light chart' }).click();
  await expect(page.locator('.wheel-panel')).toHaveClass(/light/);
  await page.locator('input[data-layer=aspects]').uncheck();
  expect(await page.evaluate(() => window.astr3.model.aspects.length)).toBeGreaterThan(0);
});

test('calculates locally, omits unknown houses, and cancels obsolete requests', async ({
  page,
}) => {
  await ready(page);
  await page.locator('#preset').selectOption('j2000');
  await expect(page.locator('#calculation-status')).toContainText('Calculated locally');
  expect(await page.evaluate(() => window.astr3.model.houses.length)).toBe(12);
  await page.locator('#house-system').selectOption('whole-sign');
  await expect
    .poll(() => page.evaluate(() => window.astr3.model.metadata?.houseSystem))
    .toBe('whole-sign');
  await page.locator('#preset').selectOption('unknown');
  await expect.poll(() => page.evaluate(() => window.astr3.model.timeUncertain)).toBe(true);
  expect(await page.evaluate(() => window.astr3.model.houses.length)).toBe(0);
  await page.locator('#preset').selectOption('sydney');
  await page.locator('#preset').selectOption('study');
  await expect(page.locator('#chart-title')).toHaveText('Grand trine study');
  await expect(page.locator('.astr3-body')).toHaveCount(14);
});

test('survives context loss/restoration and disposes repeated mounts cleanly', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const canvas = document.querySelector('.astr3 canvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2')!;
    const extension = gl.getExtension('WEBGL_lose_context')!;
    (window as unknown as { lostContext: WEBGL_lose_context }).lostContext = extension;
    extension.loseContext();
  });
  await expect.poll(() => page.evaluate(() => window.astr3.error?.code)).toBe('CONTEXT_LOST');
  await page.evaluate(() => window.astr3.select({ kind: 'body', id: 'sun' }));
  await expect(page.locator('#inspector-heading')).toHaveText('Sun');
  await page.evaluate(() => {
    (window as unknown as { lostContext: WEBGL_lose_context }).lostContext.restoreContext();
  });
  await expect.poll(() => page.evaluate(() => window.astr3.error)).toBeNull();
  const outcome = await page.evaluate(async () => {
    const modulePath = '/library.ts';
    const { createChart } = (await import(modulePath)) as typeof import('../../src/index.js');
    const host = document.createElement('div');
    host.style.width = '400px';
    document.body.append(host);
    for (let i = 0; i < 20; i++) {
      const chart = createChart(host, { data: { bodies: [] } });
      chart.dispose();
      chart.dispose();
    }
    const children = host.childElementCount;
    host.remove();
    return children;
  });
  expect(outcome).toBe(0);
});

test('retains an accessible chart if WebGL cannot be created', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      name: string,
      ...args: unknown[]
    ) {
      if (name.startsWith('webgl')) return null;
      return original.call(this, name as '2d', ...(args as []));
    } as typeof original;
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.astr3?.error?.code)).toBe('WEBGL_UNAVAILABLE');
  const sun = page.locator('.astr3-access button[data-selection="body:sun"]');
  await expect(sun).toBeVisible();
  await sun.click();
  await expect(page.locator('#inspector-heading')).toHaveText('Sun');
});

test('fits narrow layouts, respects reduced motion, and allows touch selection', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const sizes = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  expect(
    await page
      .locator('.astr3-body')
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s');
  if (isMobile) {
    const box = await page.locator('[data-object="body:sun"]').boundingBox();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect
      .poll(() => page.evaluate(() => window.astr3.selection))
      .toEqual({ kind: 'body', id: 'sun' });
  }
});

test('handles two-finger pinch without accidentally selecting an object', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Pinch is exercised with the mobile touch device.');
  await ready(page);
  await page.locator('.astr3-stage').scrollIntoViewIfNeeded();
  const center = await point(page, 0, 0);
  await page.evaluate(() =>
    window.astr3.on('view', (event) => {
      document.documentElement.dataset.zoom = String(event.zoom);
    }),
  );
  const cdp = await page.context().newCDPSession(page);
  const fingers = (distance: number) => [
    { x: center.x - distance, y: center.y, id: 1 },
    { x: center.x + distance, y: center.y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(30) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(40) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(70) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(() => page.evaluate(() => Number(document.documentElement.dataset.zoom)))
    .toBeGreaterThan(1);
  expect(await page.evaluate(() => window.astr3.selection)).toBeNull();
});

test('separates measured custom labels through responsive resize and zoom', async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.evaluate(() =>
    window.astr3.update({
      bodies: Array.from({ length: 15 }, (_, i) => ({
        id: `point-${i}`,
        name: `Point ${i}`,
        longitude: (359 + i * 0.1) % 360,
        glyph: i % 3 === 0 ? 'WW' : '☉',
        retrograde: i % 2 === 0,
      })),
    }),
  );
  // Five double-width glyphs exceed this phone's band capacity. Every ordinary
  // symbol remains visible; overflow points retain markers and list entries.
  await expect(page.locator('.astr3-access button[data-kind=body]')).toHaveCount(15);
  await expect.poll(() => page.locator('.astr3-body').count()).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.astr3-body .astr3-symbol').filter({ hasText: '☉' })).toHaveCount(10);
  const overlaps = async () =>
    page.locator('.astr3-body').evaluateAll((elements) => {
      const boxes = elements.map((element) => element.getBoundingClientRect());
      return boxes.flatMap((a, i) =>
        boxes
          .slice(i + 1)
          .filter(
            (b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
          ),
      );
    });
  await expect.poll(overlaps).toHaveLength(0);
  await expect.poll(() => planetBandViolations(page)).toEqual([]);
  await page.evaluate(() => window.astr3.zoomBy(1.4));
  await expect(page.locator('.astr3-body')).toHaveCount(15);
  await expect.poll(overlaps).toHaveLength(0);
  await expect.poll(() => planetBandViolations(page, 1.4)).toEqual([]);
  expect(await page.evaluate(() => window.astr3.model.bodies[0]!.longitude)).toBe(359);
});

test('patches orb options without resetting earlier limits and clears removed selections', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const chart = window.astr3;
    chart.update({
      bodies: [
        { id: 'a', name: 'A', longitude: 0 },
        { id: 'b', name: 'B', longitude: 123 },
      ],
    });
    chart.select({ kind: 'aspect', id: chart.model.aspects[0]!.id });
    chart.setOptions({ orbs: { trine: 2 } });
    const selection = chart.selection;
    chart.setOptions({ orbs: { square: 2 } });
    return { selection, count: chart.model.aspects.length };
  });
  expect(result).toEqual({ selection: null, count: 0 });
});

test('changes chart weight across themes while retaining sizes and selection', async ({
  page,
}, info) => {
  await ready(page);
  const weightControl = page.getByRole('combobox', { name: 'Chart weight', exact: true });
  await expect(weightControl).toHaveValue('regular');
  await page.evaluate(() => window.astr3.select({ kind: 'body', id: 'sun' }));
  const labelStyles = () =>
    page.evaluate(() => {
      const element = document.querySelector('[data-object="body:sun"]')!;
      return {
        body: getComputedStyle(element).fontSize,
        degree: getComputedStyle(element.querySelector('small')!).fontSize,
        weight: getComputedStyle(element).fontWeight,
        stroke: getComputedStyle(element.querySelector('.astr3-symbol')!).webkitTextStrokeWidth,
      };
    });
  const sizes = await labelStyles();
  for (const theme of ['dark', 'light'] as const) {
    if (theme === 'light')
      await page.getByRole('button', { name: 'Switch to light chart' }).click();
    for (const [weight, fontWeight, symbolStroke] of [
      ['light', '400', '0px'],
      ['regular', '500', '0.15px'],
      ['bold', '650', '0.3px'],
    ] as const) {
      await weightControl.selectOption(weight);
      // Read the current labels together: a scheduled redraw replaces old nodes.
      await expect
        .poll(labelStyles)
        .toEqual({ ...sizes, weight: fontWeight, stroke: symbolStroke });
      expect(await page.evaluate(() => window.astr3.selection)).toEqual({
        kind: 'body',
        id: 'sun',
      });
      await page.screenshot({
        path: `test-results/weight-${info.project.name}-${theme}-${weight}.png`,
        fullPage: true,
      });
    }
  }
  // The same control is operable with the keyboard.
  await weightControl.focus();
  await weightControl.press('l');
  await weightControl.press('Enter');
  await expect(weightControl).toHaveValue('light');
});

test('avoids house and custom planet label collisions at every weight after resizing and zooming', async ({
  page,
  isMobile,
}) => {
  await ready(page);
  await page.evaluate(() =>
    window.astr3.update({
      bodies: Array.from({ length: 15 }, (_, i) => ({
        id: `point-${i}`,
        name: `Point ${i}`,
        longitude: (359 + i / 5) % 360,
        glyph: i % 3 === 0 ? 'WW' : '☉',
        retrograde: i % 2 === 0,
      })),
      houses: Array.from({ length: 12 }, (_, i) => ({
        id: `house-${i + 1}`,
        number: i + 1,
        longitude: (345 + i * 30) % 360,
      })),
    }),
  );
  await expect(page.locator('.astr3-body')).toHaveCount(15);
  const overlaps = async () =>
    page.locator('.astr3-label').evaluateAll((elements) => {
      const bodies = elements
        .filter((element) => element.classList.contains('astr3-body'))
        .map((element) => element.getBoundingClientRect());
      const houses = elements
        .filter((element) => (element as HTMLElement).dataset.object?.startsWith('house:'))
        .map((element) => element.getBoundingClientRect());
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return bodies.reduce(
        (count, box, i) =>
          count +
          houses.filter((house) => intersects(box, house)).length +
          bodies.slice(i + 1).filter((other) => intersects(box, other)).length,
        0,
      );
    });
  for (const viewportWidth of [isMobile ? 393 : 1000, 360]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    for (const weight of ['light', 'regular', 'bold'] as const) {
      await page.getByRole('combobox', { name: 'Chart weight', exact: true }).selectOption(weight);
      await expect.poll(overlaps).toBe(0);
      await expect.poll(() => page.locator('.astr3-body').count()).toBeGreaterThanOrEqual(10);
      await expect(page.locator('.astr3-access button[data-kind=body]')).toHaveCount(15);
      await expect.poll(() => planetBandViolations(page)).toEqual([]);
      await page.evaluate(() => window.astr3.zoomBy(1.4));
      await expect(page.locator('.astr3-body')).toHaveCount(15);
      await expect.poll(overlaps).toBe(0);
      await expect.poll(() => planetBandViolations(page, 1.4)).toEqual([]);
      await page.evaluate(() => window.astr3.resetView());
    }
  }
  expect(await page.evaluate(() => window.astr3.model.bodies[0]!.longitude)).toBe(359);
  await page.locator('input[data-layer=houses]').uncheck();
  await expect(page.locator('[data-object^="house:"]')).toHaveCount(0);
  await expect.poll(overlaps).toBe(0);
  await expect.poll(() => planetBandViolations(page)).toEqual([]);
  await page.locator('#preset').selectOption('unknown');
  await expect.poll(() => page.evaluate(() => window.astr3.model.timeUncertain)).toBe(true);
  await page.locator('input[data-layer=houses]').check();
  await expect(page.locator('[data-object^="house:"]')).toHaveCount(0);
  await expect.poll(() => planetBandViolations(page)).toEqual([]);
});

test('keeps synthetic clustered planet labels outside the house ring', async ({
  page,
  isMobile,
}, info) => {
  await ready(page);
  await syntheticNatalChart(page);
  const positions = await page.evaluate(() => JSON.stringify(window.astr3.model));
  for (const width of isMobile ? [393, 360] : [1280, 900]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const weight of ['light', 'regular', 'bold']) {
      await page.locator('#chart-weight').selectOption(weight);
      await expect(page.locator('.astr3-body')).toHaveCount(14);
      await expect.poll(() => planetBandViolations(page)).toEqual([]);
    }
  }
  await expect(page.locator('.astr3-notice')).not.toContainText('Zoom in');
  expect(await page.evaluate(() => JSON.stringify(window.astr3.model))).toBe(positions);
  await page.evaluate(() => window.astr3.select({ kind: 'body', id: 'mercury' }));
  await expect(page.locator('#inspector-heading')).toHaveText('Mercury');
  await expect(page.locator('#details')).toContainText('14°15');
  await page.locator('.wheel-panel').screenshot({
    path: `test-results/natal-band-${info.project.name}.png`,
  });
});

test('compacts planet labels and restores degrees without changing selection details', async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() =>
    window.astr3.update({
      bodies: [
        { id: 'mercury', name: 'Mercury', longitude: 194.25, retrograde: true },
        { id: 'sun', name: 'Sun', longitude: 45 },
        { id: 'moon', name: 'Moon', longitude: 90 },
      ],
    }),
  );
  await expect(page.locator('.astr3-body')).toHaveCount(3);
  await expect(page.locator('.astr3-stage')).toHaveAttribute('data-label-mode', 'compact');
  await expect(page.locator('[data-object="body:mercury"] small')).toBeHidden();
  const label = await page.locator('[data-object="body:mercury"]').boundingBox();
  await page.mouse.click(label!.x + label!.width / 2, label!.y + label!.height / 2);
  await expect(page.locator('#inspector-heading')).toHaveText('Mercury');
  await expect(page.locator('#details')).toContainText('14°15');
  await expect(page.locator('#details')).toContainText('Retrograde');
  await expect.poll(() => planetBandViolations(page)).toEqual([]);
  const details = await page.locator('#details').textContent();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect(page.locator('.astr3-stage')).toHaveAttribute('data-label-mode', 'full');
  await expect(page.locator('[data-object="body:mercury"] small')).toBeVisible();
  await expect(page.locator('[data-object="body:mercury"]')).toHaveAttribute('data-active', 'true');
  expect(await page.locator('#details').textContent()).toBe(details);
  await expect.poll(() => planetBandViolations(page)).toEqual([]);
});

test('keeps overflow markers selectable and restores symbols after zooming in', async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    window.astr3.update({
      bodies: [{ id: 'mercury', name: 'Mercury', longitude: 45, retrograde: true }],
      timeUncertain: true,
    });
    window.astr3.zoomBy(0.1);
  });
  await expect(page.locator('.astr3-stage')).toHaveAttribute('data-label-mode', 'markers');
  await expect(page.locator('.astr3-body')).toHaveCount(0);
  await expect(page.locator('.astr3-notice')).toContainText('birth time uncertain');
  await expect(page.locator('.astr3-notice')).toContainText('Zoom in to reveal planet symbols');
  const marker = await point(
    page,
    -WHEEL.marker * Math.SQRT1_2 * 0.6,
    -WHEEL.marker * Math.SQRT1_2 * 0.6,
  );
  await page.mouse.click(marker.x, marker.y);
  await expect
    .poll(() => page.evaluate(() => window.astr3.selection))
    .toEqual({
      kind: 'body',
      id: 'mercury',
    });
  await expect(page.locator('#details')).toContainText('Retrograde');
  await page.locator('.astr3-access summary').click();
  await expect(page.locator('.astr3-access button[data-kind=body]')).toContainText('Mercury');
  await page.evaluate(() => window.astr3.zoomBy(3));
  await expect(page.locator('.astr3-body')).toHaveCount(1);
  await expect(page.locator('.astr3-notice')).not.toContainText('Zoom in');
  await expect(page.locator('[data-object="body:mercury"]')).toHaveAttribute('data-active', 'true');
  await expect.poll(() => planetBandViolations(page, 1.8)).toEqual([]);
});

test('keeps Light as the library default and increases rendered line coverage at higher weights', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const modulePath = '/library.ts';
    const { createChart } = (await import(modulePath)) as typeof import('../../src/index.js');
    const host = document.createElement('div');
    host.style.width = '400px';
    document.body.append(host);
    const chart = createChart(host, { data: { bodies: [] }, layers: { degrees: false } });
    const currentTextWeight = () =>
      getComputedStyle(chart.element).getPropertyValue('--astr3-label-weight');
    const initial = currentTextWeight();
    const coverage: number[] = [];
    for (const chartWeight of ['light', 'regular', 'bold'] as const) {
      chart.setOptions({ chartWeight });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          const canvas = chart.element.querySelector('canvas')!;
          const gl = canvas.getContext('webgl2')!;
          const pixels = new Uint8Array(canvas.width * canvas.height * 4);
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              Math.max(
                Math.abs(pixels[i]! - pixels[0]!),
                Math.abs(pixels[i + 1]! - pixels[1]!),
                Math.abs(pixels[i + 2]! - pixels[2]!),
              ) > 8
            )
              count++;
          coverage.push(count);
          resolve();
        }),
      );
    }
    let rejected = false;
    try {
      chart.setOptions({ chartWeight: 'heavy' as import('../../src/index.js').ChartWeight });
    } catch (error) {
      rejected = error instanceof RangeError;
    }
    const afterInvalid = currentTextWeight();
    chart.dispose();
    host.remove();
    return { initial, coverage, rejected, afterInvalid };
  });
  expect(result.initial.trim()).toBe('400');
  expect(result.coverage[0]).toBeGreaterThan(0);
  expect(result.coverage[1]).toBeGreaterThan(result.coverage[0]!);
  expect(result.coverage[2]).toBeGreaterThan(result.coverage[1]!);
  expect(result.rejected).toBe(true);
  expect(result.afterInvalid.trim()).toBe('650');
});
