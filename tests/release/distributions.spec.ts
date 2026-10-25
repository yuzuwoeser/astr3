import { test, expect } from '@playwright/test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('release archives extract to the tested distributions and match their manifest', async () => {
  const manifest = JSON.parse(readFileSync('.release/manifest.json', 'utf8'));
  const scratch = mkdtempSync(join(tmpdir(), 'astr3-archives-'));
  try {
    for (const artifact of manifest.artifacts) {
      const bytes = readFileSync(join('.release', artifact.name));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256);
      if (!artifact.name.endsWith('.zip')) continue;
      const directory = join(scratch, artifact.name);
      const result = spawnSync('unzip', ['-q', join('.release', artifact.name), '-d', directory]);
      expect(result.status, result.stderr.toString()).toBe(0);
      if (artifact.name.startsWith('astr3-browser-'))
        expect(readFileSync(join(directory, 'astr3.js'))).toEqual(
          readFileSync('.release/browser/astr3.js'),
        );
      if (artifact.name.startsWith('astr3-wordpress-')) {
        expect(readFileSync(join(directory, 'astr3/assets/astr3.js'))).toEqual(
          readFileSync('.release/browser/astr3.js'),
        );
        expect(readFileSync(join(directory, 'astr3/astr3.php'), 'utf8')).toContain(
          `Version: ${manifest.version}`,
        );
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('minimal browser starter renders without external requests', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) =>
    expect(new URL(request.url()).origin).toBe('http://127.0.0.1:4175'),
  );
  await page.goto('/extracted-browser/minimal.html');
  await expect(page.locator('.astr3-body')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('release browser bundle exports images and loads optional ephemeris', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/extracted-browser/');
  for (const format of ['SVG', 'PNG']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format}`, exact: true }).click();
    expect(await (await download).failure()).toBeNull();
  }
  await page.getByRole('button', { name: 'Calculate J2000' }).click();
  await expect(page.locator('#example > [role=status]')).toHaveText('J2000 calculated locally.');
  expect(errors).toEqual([]);
});
