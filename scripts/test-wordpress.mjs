import { runCLI } from '@wp-playground/cli';
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

if (!WebAssembly.Suspending && !process.execArgv.includes('--experimental-wasm-jspi')) {
  const child = spawnSync(
    process.execPath,
    ['--experimental-wasm-jspi', ...process.argv.slice(1)],
    { stdio: 'inherit' },
  );
  process.exit(child.status ?? 1);
}
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const cli = await runCLI({
  command: 'server',
  port: 4176,
  wp: process.env.ASTR3_WP_VERSION ?? '6.5',
  php: process.env.ASTR3_PHP_VERSION ?? '8.0',
  workers: 1,
  login: true,
  verbosity: 'normal',
  mount: [{ hostPath: resolve('.release'), vfsPath: '/mnt/release' }],
  blueprint: {
    steps: [
      {
        step: 'installPlugin',
        pluginData: { resource: 'vfs', path: `/mnt/release/astr3-wordpress-${version}.zip` },
        options: { activate: true },
      },
    ],
  },
});
let browser;
try {
  const sample = {
    bodies: [
      { id: 'sun', name: 'Sun', longitude: 0 },
      { id: 'moon', name: 'Moon', longitude: 120 },
    ],
  };
  const attrs = {
    chartId: 'first',
    kind: 'natal',
    preset: 'midnight',
    label: 'My natal chart',
    dataJson: JSON.stringify(sample),
  };
  const block = (attributes) => `<!-- wp:astr3/chart ${JSON.stringify(attributes)} /-->`;
  const content =
    block(attrs) +
    block({
      ...attrs,
      chartId: 'second',
      kind: 'transit',
      preset: 'transit',
      dataJson: JSON.stringify({ natal: sample, transit: sample }),
    }) +
    '\n[astr3_chart id="first"]\n[astr3_chart id="missing"]';
  const encoded = Buffer.from(content).toString('base64');
  const setup = await cli.playground.run({
    code: `<?php
require '/wordpress/wp-load.php';
$id = wp_insert_post(array('post_title' => 'ASTR3 integration test', 'post_status' => 'publish', 'post_type' => 'page', 'post_content' => wp_slash(base64_decode('${encoded}'))));
$plain = wp_insert_post(array('post_title' => 'Plain page', 'post_status' => 'publish', 'post_type' => 'page', 'post_content' => 'No charts here.'));
if (strpos(astr3_render_chart(array('dataJson' => 'broken')), 'Invalid ASTR3 chart JSON') === false) { throw new Exception('Malformed JSON was not rejected.'); }
echo json_encode(array('id' => $id, 'url' => get_permalink($id), 'plainUrl' => get_permalink($plain)));
`,
  });
  assert.equal(setup.exitCode, 0, setup.errors);
  const post = JSON.parse(setup.text);
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(post.plainUrl);
  assert.equal(
    await page.locator('script[src*="plugins/astr3"],link[href*="plugins/astr3"]').count(),
    0,
    'No chart assets on a page without charts',
  );
  await page.goto(post.url);
  await page.waitForFunction(() => document.querySelectorAll('astr3-embed .astr3').length === 3);
  assert.equal(await page.locator('astr3-embed').count(), 3, 'Two blocks plus shortcode');
  assert.ok((await page.locator('body').textContent()).includes('ASTR3 chart not found'));
  // Native custom-element disconnection must release the renderer and reconnect once.
  await page.evaluate(() => {
    const element = document.querySelector('astr3-embed');
    const parent = element.parentElement;
    element.remove();
    if (element.querySelector('.astr3')) throw new Error('Chart survived disconnection');
    parent.append(element);
  });
  await page.waitForFunction(() => document.querySelectorAll('astr3-embed .astr3').length === 3);
  // Verify the frontend fallback rather than allowing WebGL failure to hide a broken mount.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' || type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  await page.reload();
  await page.waitForSelector('astr3-embed .astr3');
  assert.equal(await page.locator('astr3-embed .astr3').count(), 3);
  assert.ok((await page.locator('astr3-embed button').count()) > 0, 'Accessible object controls');
  await page.close();

  const editor = await browser.newPage();
  // The welcome guide can appear after the blocks load, including during a click.
  await editor.addLocatorHandler(
    editor.getByRole('dialog', { name: /Welcome/ }),
    async (dialog) => {
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    },
  );
  await editor.goto(`${cli.serverUrl}/wp-admin/post.php?post=${post.id}&action=edit`);
  await editor.waitForFunction(
    () => window.wp?.data?.select('core/block-editor')?.getBlocks()?.length > 0,
  );
  const frame = (await editor.locator('iframe[name="editor-canvas"]').count())
    ? editor.frameLocator('iframe[name="editor-canvas"]')
    : editor;
  await frame.getByRole('button', { name: 'Preview chart', exact: true }).first().click();
  await frame.locator('.astr3-chart-host .astr3').first().waitFor();
  await frame
    .locator('.astr3-chart-host canvas')
    .first()
    .evaluate((canvas) => {
      canvas.astr3Retained = true;
    });
  const jsonField = frame.getByLabel('Chart JSON', { exact: true }).first();
  await jsonField.fill('{ broken');
  await frame.getByRole('button', { name: 'Preview chart', exact: true }).first().click();
  await frame
    .locator('.components-notice__content')
    .filter({ hasText: /JSON|Unexpected|Expected property/ })
    .first()
    .waitFor();
  assert.ok(
    (await frame.locator('.astr3-chart-host .astr3').count()) > 0,
    'Invalid edit retains preview',
  );
  const hostile = {
    bodies: [
      { id: 'sun', name: '</script><script>window.astr3Injected=true</script>', longitude: 45 },
    ],
  };
  await jsonField.fill(JSON.stringify(hostile));
  await frame.getByRole('button', { name: 'Preview chart', exact: true }).first().click();
  await frame
    .locator('.components-notice__content')
    .filter({ hasText: 'Preview ready.' })
    .first()
    .waitFor();
  assert.equal(
    await frame
      .locator('.astr3-chart-host canvas')
      .first()
      .evaluate((canvas) => canvas.astr3Retained),
    true,
    'Data-only preview update retains its renderer',
  );
  await editor.evaluate(async () => {
    await wp.data.dispatch('core/editor').savePost();
  });
  await editor.reload();
  await editor.waitForFunction(
    () => window.wp?.data?.select('core/block-editor')?.getBlocks()?.length > 0,
  );
  const saved = await editor.evaluate(
    () =>
      wp.data
        .select('core/block-editor')
        .getBlocks()
        .find((block) => block.name === 'astr3/chart').attributes,
  );
  assert.equal(JSON.parse(saved.dataJson).bodies[0].longitude, 45);
  const publicPage = await browser.newPage();
  await publicPage.goto(post.url);
  await publicPage.waitForSelector('astr3-embed .astr3');
  assert.equal(
    await publicPage.evaluate(() => window.astr3Injected),
    undefined,
    'Embedded data cannot execute',
  );
  assert.ok((await publicPage.locator('astr3-embed').first().textContent()).includes('</script>'));
  assert.deepEqual(errors, []);
  console.log(
    `WordPress ${process.env.ASTR3_WP_VERSION ?? '6.5'} / PHP ${process.env.ASTR3_PHP_VERSION ?? '8.0'}: ZIP installation, editor preview/save/reload, natal/transit, shortcode, lifecycle, escaping and WebGL fallback passed.`,
  );
} catch (error) {
  mkdirSync('test-results/wordpress', { recursive: true });
  for (const [index, page] of (
    browser?.contexts().flatMap((context) => context.pages()) ?? []
  ).entries()) {
    writeFileSync(`test-results/wordpress/page-${index}.html`, await page.content());
    console.error(await page.locator('astr3-embed > [role=status]').allTextContents());
    await page.screenshot({ path: `test-results/wordpress/page-${index}.png`, fullPage: true });
  }
  throw error;
} finally {
  await browser?.close();
  await cli[Symbol.asyncDispose]();
}
