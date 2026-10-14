import type { Page } from 'playwright';

/** Network idle is unsuitable for live odds; wait for readable content instead. */
export async function waitForPageContent(page: Page) {
  await page
    .waitForFunction(
      () => {
        const text = document.body?.innerText.trim() || '';
        return text.length >= 240 && text.split(/\s+/u).length >= 30;
      },
      undefined,
      { timeout: 45000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1200);
  // Trigger lazy-loaded footer and images, then return to the actual first screen.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page
    .waitForFunction(() => (document.body?.innerText.trim().length || 0) >= 240, undefined, {
      timeout: 15000,
    })
    .catch(() => {});
}
