import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
}
async function transits(page: Page) {
  await page.locator('#chart-view').selectOption('transit');
  await page.locator('#transit-utc').fill('2024-04-08T18:00');
  await page.locator('#transit-utc').dispatchEvent('change');
  await expect
    .poll(() => page.evaluate(() => window.astr3Transit?.model.transit.metadata?.utc))
    .toBe('2024-04-08T18:00:00.000Z');
}

test('lazily exports vector SVG and captures state without altering the live chart', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await ready(page);
  expect(requests.some((url) => url.includes('export-font-data'))).toBe(false);
  const result = await page.evaluate(async () => {
    const chart = window.astr3;
    const expected = await chart.exportSvg();
    chart.select({ kind: 'body', id: 'sun' });
    chart.zoomBy(1.4);
    let events = 0;
    const off = (['selection', 'hover', 'view', 'update', 'error'] as const).map((name) =>
      chart.on(name, () => events++),
    );
    const state = JSON.stringify({ model: chart.model, selection: chart.selection });
    const full = await chart.exportSvg();
    const current = await chart.exportSvg({ view: 'current', size: 700 });
    const unchanged = state === JSON.stringify({ model: chart.model, selection: chart.selection });
    off.forEach((unsubscribe) => unsubscribe());
    const pending = chart.exportSvg();
    chart.update({ title: 'Later chart', bodies: [{ id: 'moon', name: 'Moon', longitude: 40 }] });
    const captured = await pending;
    const xml = new DOMParser().parseFromString(full, 'image/svg+xml');
    return {
      expected,
      full,
      current,
      unchanged,
      events,
      captured,
      parseErrors: xml.querySelectorAll('parsererror').length,
      text: xml.querySelectorAll('text,image,foreignObject,script').length,
      paths: xml.querySelectorAll('path').length,
    };
  });
  expect(result.full).toBe(result.expected);
  expect(result.captured).toBe(result.expected);
  expect(result.current).not.toBe(result.full);
  expect(result.current).toContain('width="700"');
  expect(result.unchanged).toBe(true);
  expect(result.events).toBe(0);
  expect(result.parseErrors).toBe(0);
  expect(result.text).toBe(0);
  expect(result.paths).toBeGreaterThan(100);
  expect(requests.some((url) => url.includes('export-font-data'))).toBe(true);
});

for (const layout of ['default', 'alternative'] as const) {
  test(`exports ${layout} natal/transit wheels and PNG pixels matching the SVG`, async ({
    page,
  }, testInfo) => {
    await ready(page);
    await page.locator('#chart-layout').selectOption(layout);
    await page.locator('#theme-toggle').click();
    await page.locator('#chart-weight').selectOption('bold');
    await transits(page);
    const result = await page.evaluate(async () => {
      const chart = window.astr3Transit!;
      chart.setOptions({
        bodyVisibility: { transit: { moon: false } },
        layers: { transitAspects: false },
      });
      const options = { size: 512, transparent: true };
      const svg = await chart.exportSvg(options);
      const blob = await chart.exportPng({ ...options, pixelRatio: 1 });
      async function pixels(blob: Blob) {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        try {
          image.src = url;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          return { pixels, size: [image.naturalWidth, image.naturalHeight] };
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const png = await pixels(blob);
      const source = await pixels(new Blob([svg], { type: 'image/svg+xml' }));
      let difference = 0,
        painted = 0;
      png.pixels.forEach((value, i) => {
        difference += Math.abs(value - source.pixels[i]!);
        if (i % 4 === 3 && value) painted++;
      });
      const natal = await window.astr3.exportSvg({ size: 512 });
      return {
        mime: blob.type,
        size: png.size,
        painted,
        cornerAlpha: png.pixels[3],
        difference,
        svg,
        natal,
        pngBytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      };
    });
    expect(result.mime).toBe('image/png');
    expect(result.size).toEqual([512, 512]);
    expect(result.painted).toBeGreaterThan(4000);
    expect(result.cornerAlpha).toBe(0);
    expect(result.difference / (512 * 512 * 4)).toBeLessThan(0.1);
    expect(result.svg).not.toContain('image href');
    expect(result.svg).not.toMatch(/\[&quot;(?:natal|transit|cross)&quot;/);
    expect(result.natal).toContain('width="512"');
    await testInfo.attach(`${layout}-transit.png`, {
      body: Buffer.from(result.pngBytes),
      contentType: 'image/png',
    });
    // Keep reviewable artifacts in Playwright's ignored output directory.
    await writeFile(testInfo.outputPath(`${layout}-transit.png`), Buffer.from(result.pngBytes));
  });
}

test('rejects invalid exports and unsupported text while preserving the chart', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const chart = window.astr3;
    const errors: string[] = [];
    for (const options of [
      { size: 0 },
      { size: NaN },
      { size: 8193 },
      { size: 4096, pixelRatio: 2 },
      { pixelRatio: -1 },
      { view: 'other' },
    ]) {
      try {
        await chart.exportPng(options as Parameters<typeof chart.exportPng>[0]);
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
    chart.setOptions({ glyphs: { sun: '中' } });
    const before = JSON.stringify(chart.model);
    try {
      await chart.exportSvg();
    } catch (error) {
      errors.push((error as Error).message);
    }
    const intact = before === JSON.stringify(chart.model);
    chart.setOptions({ bodyVisibility: { sun: false } });
    const hidden = await chart.exportSvg({ size: 256 });
    chart.dispose();
    try {
      await chart.exportSvg();
    } catch (error) {
      errors.push((error as Error).message);
    }
    return { errors, intact, hidden };
  });
  expect(result.errors).toHaveLength(8);
  expect(result.errors[6]).toContain('U+4E2D');
  expect(result.errors[7]).toContain('disposed');
  expect(result.intact).toBe(true);
  expect(result.hidden).toContain('<svg');
});

test('exports without WebGL and releases PNG resources on encoding failure', async ({ page }) => {
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
  await ready(page);
  const result = await page.evaluate(async () => {
    const chart = window.astr3;
    const svg = await chart.exportSvg({ size: 256 });
    const png = await chart.exportPng({ size: 128, pixelRatio: 2 });
    const create = URL.createObjectURL,
      revoke = URL.revokeObjectURL;
    let created = 0,
      released = 0;
    URL.createObjectURL = (blob) => {
      created++;
      return create(blob);
    };
    URL.revokeObjectURL = (url) => {
      released++;
      revoke(url);
    };
    const encode = HTMLCanvasElement.prototype.toBlob;
    let message = '';
    try {
      HTMLCanvasElement.prototype.toBlob = (callback) => callback(null);
      await chart.exportPng({ size: 128 });
    } catch (error) {
      message = (error as Error).message;
    } finally {
      HTMLCanvasElement.prototype.toBlob = encode;
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
    }
    return { svg, pngType: png.type, created, released, message, error: chart.error?.code };
  });
  expect(result.svg).toContain('<path');
  expect(result.svg).not.toContain('WebGL');
  expect(result.pngType).toBe('image/png');
  expect(result.error).toBe('WEBGL_UNAVAILABLE');
  expect(result.created).toBe(1);
  expect(result.released).toBe(1);
  expect(result.message).toContain('encode');
});

test('captures the displayed transit sample while time-step animation continues', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ready(page);
  await transits(page);
  await page.clock.install();
  await page.locator('#transit-animate').check();
  await page.locator('#transit-step').selectOption('week');
  await page.locator('#transit-next').click();
  await page.waitForFunction(() => window.astr3TransitAnimation?.state.status === 'playing');
  const result = await page.evaluate(async () => {
    const chart = window.astr3Transit!;
    const expected = await chart.exportSvg({ size: 512 });
    const pending = chart.exportSvg({ size: 512 });
    const time = window.astr3TransitAnimation!.state.currentTime;
    window.astr3TransitAnimation!.cancel();
    chart.updateTransit({ bodies: [{ id: 'sun', name: 'Sun', longitude: 222 }] });
    return { expected, captured: await pending, time };
  });
  expect(result.time).toBeTruthy();
  expect(result.captured).toBe(result.expected);
});

test('demo downloads both formats and reports export errors', async ({ page }) => {
  await ready(page);
  const downloadSvg = page.waitForEvent('download');
  await page.locator('#export-svg').click();
  const svgFile = await downloadSvg;
  expect(svgFile.suggestedFilename()).toBe('astr3-natal.svg');
  const svg = await readFile((await svgFile.path())!, 'utf8');
  expect(svg).toContain('<svg');
  const downloadPng = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const pngFile = await downloadPng;
  const png = await readFile((await pngFile.path())!);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(2048);
  expect(png.readUInt32BE(20)).toBe(2048);
  await page.evaluate(() => window.astr3.setOptions({ glyphs: { sun: '中' } }));
  await page.locator('#export-svg').click();
  await expect(page.locator('#export-status')).toContainText('U+4E2D');
  await expect(page.locator('#export-svg')).toBeEnabled();
  await expect(page.locator('#export-svg-large')).toBeEnabled();
  await expect(page.locator('#export-png')).toBeEnabled();
});

for (const layout of ['default', 'alternative'] as const) {
  test(`large SVG download restores crowded natal/transit captions in ${layout} layout`, async ({
    page,
  }) => {
    await ready(page);
    await page.locator('#chart-layout').selectOption(layout);
    const data = {
      title: 'Synthetic crowded export study',
      bodies: Array.from({ length: 6 }, (_, i) => ({
        id: `point-${i}`,
        name: `Point ${i}`,
        longitude: (359 + i / 10) % 360,
        glyph: '☉',
        retrograde: i % 2 === 0,
      })),
      aspects: [],
    };
    for (const mode of ['natal', 'transit'] as const) {
      if (mode === 'transit') {
        await transits(page);
        await page.evaluate(
          (data) => window.astr3Transit!.update({ natal: data, transit: data }),
          data,
        );
      } else await page.evaluate((data) => window.astr3.update(data), data);
      const standard = await page.evaluate(
        (mode) => (mode === 'transit' ? window.astr3Transit! : window.astr3).exportSvg(),
        mode,
      );
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download large SVG', exact: true }).click();
      const file = await download;
      expect(file.suggestedFilename()).toBe(`astr3-${mode}-large.svg`);
      const svg = await readFile((await file.path())!, 'utf8');
      const result = await page.evaluate(
        ({ standard, svg }) => {
          function inspect(source: string) {
            const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
            // Body labels contain a background rectangle and separate outlined
            // symbol/caption groups; cluster badges have only one text group.
            const captions = [...xml.querySelectorAll('g[opacity]')].filter(
              (group) =>
                group.querySelector(':scope > rect') &&
                group.querySelectorAll(':scope > g[fill]').length === 2,
            );
            return {
              width: xml.documentElement.getAttribute('width'),
              height: xml.documentElement.getAttribute('height'),
              captions: captions.length,
            };
          }
          return { standard: inspect(standard), large: inspect(svg) };
        },
        { standard, svg },
      );
      expect(result.large.width).toBe('4096');
      expect(result.large.height).toBe('4096');
      expect(result.large.captions).toBe(mode === 'transit' ? 12 : 6);
      expect(result.large.captions).toBeGreaterThan(result.standard.captions);
      await expect(page.locator('#export-status')).toHaveText('Large SVG download ready.');
    }
  });
}

test('current-view exports preserve rectangular viewports and survive disposal after capture', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const modulePath = '/library.ts';
    const { createChart } = (await import(modulePath)) as typeof import('../../src/index.js');
    const host = document.createElement('div');
    host.id = 'export-fixture';
    host.style.width = '200px';
    document.body.append(host);
    const chart = createChart(host, {
      data: { bodies: [{ id: 'sun', name: 'Sun', longitude: 12 }], aspects: [] },
    });
    window.astr3 = chart;
    chart.zoomBy(1.3);
  });
  const stage = page.locator('#export-fixture .astr3-stage');
  await expect(stage).toHaveCSS('height', '280px');
  await stage.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.astr3.exportSvg({ view: 'current', size: 500 }));
  const rect = (await stage.boundingBox())!;
  await page.mouse.move(rect.x + 100, rect.y + 140);
  await page.mouse.down();
  await page.mouse.move(rect.x + 130, rect.y + 150);
  await page.mouse.up();
  const result = await page.evaluate(async () => {
    const chart = window.astr3;
    const after = await chart.exportSvg({ view: 'current', size: 500 });
    const png = await chart.exportPng({ view: 'current', size: 500, pixelRatio: 1 });
    const image = await createImageBitmap(png);
    const dimensions = [image.width, image.height];
    image.close();
    const full = await chart.exportSvg({ size: 500 });
    const pending = chart.exportSvg({ view: 'current', size: 500 });
    chart.dispose();
    return { after, captured: await pending, full, dimensions };
  });
  expect(before).toContain('width="500" height="700" viewBox="0 0 200 280"');
  expect(result.after).not.toBe(before);
  expect(result.captured).toBe(result.after);
  expect(result.full).toContain('width="500" height="500"');
  expect(result.dimensions).toEqual([500, 700]);
});

test('releases PNG object URLs on SVG decode and 2D canvas failures', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const chart = window.astr3;
    const create = URL.createObjectURL,
      revoke = URL.revokeObjectURL;
    let created = 0,
      released = 0;
    URL.createObjectURL = (blob) => {
      created++;
      return create(blob);
    };
    URL.revokeObjectURL = (url) => {
      released++;
      revoke(url);
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    const errors: string[] = [];
    try {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        ...src,
        set() {
          src.set!.call(this, 'data:image/svg+xml,invalid');
        },
      });
      try {
        await chart.exportPng({ size: 128 });
      } catch (error) {
        errors.push((error as Error).message);
      }
      Object.defineProperty(HTMLImageElement.prototype, 'src', src);
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        name: string,
        ...args: unknown[]
      ) {
        if (name === '2d') return null;
        return getContext.call(this, name as '2d', ...(args as []));
      } as typeof getContext;
      try {
        await chart.exportPng({ size: 128 });
      } catch (error) {
        errors.push((error as Error).message);
      }
    } finally {
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
      HTMLCanvasElement.prototype.getContext = getContext;
      Object.defineProperty(HTMLImageElement.prototype, 'src', src);
    }
    return { created, released, errors, error: chart.error };
  });
  expect(result.errors).toHaveLength(2);
  expect(result.errors[0]).toContain('decode');
  expect(result.errors[1]).toContain('2D canvas');
  expect(result.created).toBe(2);
  expect(result.released).toBe(2);
  expect(result.error).toBeNull();
});
