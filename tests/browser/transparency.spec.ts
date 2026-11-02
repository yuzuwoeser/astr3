import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function frame(page: Page, kind: 'natal' | 'transit') {
  return page.evaluate((kind) => {
    const chart = kind === 'natal' ? window.astr3 : window.astr3Transit!;
    // Request a fresh draw so pixels are read before the drawing buffer is discarded.
    chart.zoomBy(1);
    return new Promise<{ corner: number[]; painted: number; alpha: boolean }>((resolve) =>
      requestAnimationFrame(() => {
        const canvas = chart.element.querySelector('canvas')!;
        const gl = canvas.getContext('webgl2')!;
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let painted = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++;
        resolve({
          corner: [...pixels.slice(0, 4)],
          painted,
          alpha: gl.getContextAttributes()!.alpha === true,
        });
      }),
    );
  }, kind);
}

for (const kind of ['natal', 'transit'] as const) {
  test(`${kind} transparency works at creation and during updates with real WebGL alpha`, async ({
    page,
  }) => {
    await page.goto('/examples/');
    const creation = await page.evaluate(async (kind) => {
      const modulePath = '/library.ts';
      const { createChart, createTransitChart } = (await import(
        modulePath
      )) as typeof import('../../src/index.js');
      const host = document.createElement('div');
      host.id = 'transparent-fixture';
      host.style.cssText = 'width:min(100%,600px);background:#456789';
      document.body.append(host);
      const data = {
        bodies: [
          { id: 'sun', name: 'Sun', longitude: 0 },
          { id: 'moon', name: 'Moon', longitude: 120 },
          { id: 'mars', name: 'Mars', longitude: 240 },
        ],
      };
      const mount = (transparent: boolean) =>
        kind === 'natal'
          ? createChart(host, { data, transparent })
          : createTransitChart(host, { data: { natal: data, transit: data }, transparent });
      const errors: string[] = [];
      for (const value of [null, 0, 1, 'true', {}]) {
        try {
          mount(value as boolean);
        } catch (error) {
          errors.push((error as Error).message);
        }
      }
      const leftover = host.childElementCount;
      if (kind === 'natal') {
        window.astr3 = mount(true) as typeof window.astr3;
        window.astr3.select({ kind: 'body', id: 'sun' });
      } else {
        window.astr3Transit = mount(true) as NonNullable<typeof window.astr3Transit>;
        window.astr3Transit.select({ kind: 'body', chart: 'transit', id: 'sun' });
      }
      return { errors, leftover };
    }, kind);
    expect(creation.errors).toEqual(Array(5).fill('Chart transparent must be a boolean.'));
    expect(creation.leftover).toBe(0);
    const root = page.locator('#transparent-fixture .astr3');
    await expect(root.locator('.astr3-body').first()).toBeVisible();
    await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(root.locator('.astr3-body').first()).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(root.locator('.astr3-access')).toHaveCSS('background-color', 'rgb(17, 28, 32)');
    const transparent = await frame(page, kind);
    expect(transparent.corner).toEqual([0, 0, 0, 0]);
    expect(transparent.alpha).toBe(true);
    expect(transparent.painted).toBeGreaterThan(500);

    const validation = await page.evaluate((kind) => {
      const chart = kind === 'natal' ? window.astr3 : window.astr3Transit!;
      chart.setOptions({ transparent: false, theme: { background: '#263849' } });
      const model = chart.model;
      const selection = JSON.stringify(chart.selection);
      let updates = 0;
      const off = chart.on('update', () => updates++);
      const errors: string[] = [];
      for (const value of [null, 0, 1, 'false', {}]) {
        try {
          chart.setOptions({ transparent: value as boolean, theme: { background: '#badbad' } });
        } catch (error) {
          errors.push((error as Error).message);
        }
      }
      off();
      return {
        errors,
        updates,
        intact: model === chart.model && selection === JSON.stringify(chart.selection),
      };
    }, kind);
    expect(validation.errors).toHaveLength(5);
    expect(validation.updates).toBe(0);
    expect(validation.intact).toBe(true);
    await expect(root).toHaveCSS('background-color', 'rgb(38, 56, 73)');
    await expect(root.locator('.astr3-body').first()).toHaveCSS(
      'background-color',
      'rgb(38, 56, 73)',
    );
    expect((await frame(page, kind)).corner).toEqual([38, 56, 73, 255]);
    await page.evaluate((kind) => {
      const chart = kind === 'natal' ? window.astr3 : window.astr3Transit!;
      chart.setOptions({ transparent: true });
      chart.setOptions({ layers: { groups: false } });
    }, kind);
    await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(root.locator('.astr3-body').first()).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    expect((await frame(page, kind)).corner[3]).toBe(0);
    await page.evaluate((kind) => {
      const data = {
        bodies: Array.from({ length: 55 }, (_, i) => ({
          id: `point-${i}`,
          name: `Point ${i}`,
          longitude: i / 100,
          glyph: '☉',
        })),
        aspects: [],
      };
      if (kind === 'natal') window.astr3.update(data);
      else window.astr3Transit!.update({ natal: data, transit: data });
    }, kind);
    const badge = root.locator('.astr3-cluster').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.evaluate((kind) => {
      const chart = kind === 'natal' ? window.astr3 : window.astr3Transit!;
      chart.setOptions({ transparent: false });
    }, kind);
    await expect(badge).toHaveCSS('background-color', 'rgb(38, 56, 73)');
  });

  test(`${kind} SVG and PNG inherit transparency, allow overrides, and capture it at call time`, async ({
    page,
  }) => {
    await page.goto('/playground/');
    await expect(page.locator('#chart .astr3-body')).toHaveCount(14);
    if (kind === 'transit') await page.locator('#chart-view').selectOption('transit');
    const result = await page.evaluate(async (kind) => {
      const chart = kind === 'natal' ? window.astr3 : window.astr3Transit!;
      const background = (svg: string) =>
        new DOMParser()
          .parseFromString(svg, 'image/svg+xml')
          .querySelector('svg > g > rect')
          ?.getAttribute('fill') ?? null;
      const labelFills = (svg: string) =>
        [
          ...new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('rect[rx="7"]'),
        ].map((rect) => rect.getAttribute('fill'));
      const alpha = async (blob: Blob) => {
        const image = await createImageBitmap(blob);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, 1, 1).data[3];
        } finally {
          image.close();
        }
      };
      const opaqueDefault = background(await chart.exportSvg({ size: 256 }));
      chart.setOptions({ transparent: true });
      // Keep enough room for transit labels; small exports can use exact dots only.
      const capturedSvg = chart.exportSvg({ size: 1024 });
      const capturedPng = chart.exportPng({ size: 256, pixelRatio: 1 });
      chart.setOptions({ transparent: false });
      const transparentOverride = background(
        await chart.exportSvg({ size: 256, transparent: true }),
      );
      chart.setOptions({ transparent: true });
      const opaqueOverride = background(await chart.exportSvg({ size: 256, transparent: false }));
      const transparentLabels = labelFills(await capturedSvg);
      const opaqueLabels = labelFills(await chart.exportSvg({ size: 1024, transparent: false }));
      return {
        opaqueDefault,
        opaqueOverride,
        transparentOverride,
        capturedSvg: background(await capturedSvg),
        capturedPng: await alpha(await capturedPng),
        inherited: background(await chart.exportSvg({ size: 256, view: 'current' })),
        overriddenPng: await alpha(
          await chart.exportPng({ size: 256, pixelRatio: 1, transparent: false }),
        ),
        transparentLabels:
          transparentLabels.length > 0 && transparentLabels.every((fill) => fill === 'none'),
        opaqueLabels: opaqueLabels.length > 0 && opaqueLabels.every((fill) => fill === '#111c20'),
      };
    }, kind);
    expect(result).toEqual({
      opaqueDefault: '#111c20',
      opaqueOverride: '#111c20',
      transparentOverride: null,
      capturedSvg: null,
      capturedPng: 0,
      inherited: null,
      overriddenPng: 255,
      transparentLabels: true,
      opaqueLabels: true,
    });
  });
}

test('demo transparency follows themes, layouts, view switches, and downloads', async ({
  page,
}, info) => {
  await page.goto('/playground/');
  const toggle = page.getByRole('checkbox', { name: 'Transparent background', exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.locator('#theme-toggle').click();
  for (const kind of ['natal', 'transit'] as const) {
    await page.locator('#chart-view').selectOption(kind);
    const root = page.locator(`${kind === 'natal' ? '#chart' : '#transit-chart'} .astr3`);
    for (const layout of ['default', 'alternative', 'advanced']) {
      await page.locator('#chart-layout').selectOption(layout);
      await expect(root).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(root).toHaveAttribute('data-layout', layout);
    }
    await root.screenshot({ path: info.outputPath(`${kind}-transparent.png`) });
    const pending = page.waitForEvent('download');
    await page.locator('#export-svg').click();
    const download = await pending;
    const svg = await readFile((await download.path())!, 'utf8');
    expect(svg).not.toContain('height="800" fill=');
    await expect(page.locator('.wheel-panel')).toHaveClass(/transparent/);
  }
  await toggle.uncheck();
  for (const kind of ['transit', 'natal']) {
    await page.locator('#chart-view').selectOption(kind);
    await expect(
      page.locator(`${kind === 'natal' ? '#chart' : '#transit-chart'} .astr3`),
    ).toHaveCSS('background-color', 'rgb(247, 245, 237)');
  }
  await expect(page.locator('.wheel-panel')).not.toHaveClass(/transparent/);
});

test('transparent backgrounds retain the accessible fallback without WebGL', async ({ page }) => {
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
  await page.goto('/playground/');
  await page.getByRole('checkbox', { name: 'Transparent background', exact: true }).check();
  await expect(page.locator('#chart .astr3')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#chart .astr3-access')).toHaveAttribute('open', '');
  await page
    .locator('#chart .astr3-access')
    .getByRole('button', { name: /^Sun ·/ })
    .click();
  expect(await page.evaluate(() => window.astr3.selection)).toEqual({ kind: 'body', id: 'sun' });
  const result = await page.evaluate(async () => ({
    error: window.astr3.error?.code,
    svg: await window.astr3.exportSvg({ size: 256 }),
  }));
  expect(result.error).toBe('WEBGL_UNAVAILABLE');
  expect(result.svg).not.toContain('height="256" fill=');
});
