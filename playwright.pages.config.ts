import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.config.js';

export default defineConfig({
  ...browserConfig,
  testDir: './tests/pages',
  outputDir: './test-results/pages',
  use: { ...browserConfig.use, baseURL: 'http://127.0.0.1:4174/astr3/' },
  webServer: {
    command: 'npm run preview:pages',
    url: 'http://127.0.0.1:4174/astr3/',
    // A reused dev server could hide missing production assets or a stale build.
    reuseExistingServer: false,
  },
});
