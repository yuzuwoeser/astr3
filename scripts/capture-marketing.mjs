import { mkdir, rename, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { serveDirectory } from './static-server.mjs';

// Run after a root-base `npm run build:site`. No external service is contacted.
const output = resolve('site/public/marketing');
const recording = resolve('test-results/marketing-recording');
await mkdir(output, { recursive: true });
await mkdir(recording, { recursive: true });
const server = serveDirectory('site-dist');
await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 1,
    recordVideo: { dir: recording, size: { width: 1280, height: 1000 } },
  });
  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(message.text());
  });
  page.on('requestfailed', (request) => issues.push(`Request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) issues.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/examples/selection/`);
  await page.locator('[data-selection-title]').filter({ hasText: 'Natal Sun' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('canvas').waitFor();
  const demo = page.locator('[data-selection-demo]');
  await demo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(750);
  await demo.screenshot({ path: join(output, 'selection-demo.png') });
  // Deliberate pauses make the recorded interaction readable in a 25-second clip.
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Select Moon', exact: true }).click();
  assert.equal(await page.locator('[data-selection-title]').textContent(), 'Natal Moon');
  await demo.screenshot({ path: join(output, 'selection-moon.png') });
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Select Sun', exact: true }).click();
  await page.waitForTimeout(3500);
  for (let step = 1; step <= 3; step++) {
    await page.getByRole('button', { name: 'Next transit step' }).click();
    assert.equal(
      await page.locator('[data-selection-step]').textContent(),
      `Invented transit step ${step}`,
    );
    await page.waitForTimeout(3000);
  }
  assert.deepEqual(issues, [], 'Capture must contain no browser or asset errors');
  const video = page.video();
  await context.close();
  // Replace only the previous generated clip, never arbitrary files.
  await rm(join(output, 'selection-demo.webm'), { force: true });
  await rename(await video.path(), join(output, 'selection-demo.webm'));
  console.log('Captured two screenshots and the selection/transit clip in site/public/marketing/.');
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
