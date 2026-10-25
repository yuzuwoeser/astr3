import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.config.js';

export default defineConfig({
  ...browserConfig,
  testDir: './tests/release',
  outputDir: './test-results/release',
  use: { ...browserConfig.use, baseURL: 'http://127.0.0.1:4175' },
  webServer: {
    command: 'node scripts/serve-release.mjs',
    url: 'http://127.0.0.1:4175/extracted-browser/minimal.html',
    reuseExistingServer: false,
  },
});
