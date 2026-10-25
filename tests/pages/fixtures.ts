import { expect, test as base } from '@playwright/test';

// These tests exercise the built application, never Vite's development-only
// /library.ts entry. Watch lazy imports and fonts as well as the initial HTML.
export const test = base.extend<{ assetRequests: string[] }>({
  assetRequests: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL!).origin;
      const requests: string[] = [],
        issues: string[] = [];
      page.on('pageerror', (error) => issues.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') issues.push(message.text());
      });
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!['http:', 'https:'].includes(url.protocol)) return;
        requests.push(url.pathname);
        if (url.origin !== origin || !url.pathname.startsWith('/astr3/'))
          issues.push(`Application request outside the Pages base: ${request.url()}`);
      });
      page.on('requestfailed', (request) => {
        if (request.url().startsWith(origin))
          issues.push(`Request failed: ${request.url()} (${request.failure()?.errorText})`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400) issues.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await use(requests);
      expect(issues, 'Production application errors or missing assets').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
