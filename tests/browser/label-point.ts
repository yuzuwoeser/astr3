import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Query and measure in one browser turn: a redraw can replace any label node. */
export async function labelPoint(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible();
  return page.evaluate((selector) => {
    const element = document.querySelector<HTMLElement>(selector)!;
    const rect = element.getBoundingClientRect();
    // Scroll only the page, keeping the wheel's clipped layers at scroll offset 0.
    window.scrollBy({ top: rect.y + rect.height / 2 - innerHeight / 2, behavior: 'instant' });
    const visible = element.getBoundingClientRect();
    return { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 };
  }, selector);
}
