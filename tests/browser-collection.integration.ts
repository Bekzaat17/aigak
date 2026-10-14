import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { locateVisibleQuote } from '../server/collection/locate-visible-quote.ts';
import { installBrowserNetworkPolicy } from '../server/collection/install-browser-network-policy.ts';

test('exact quote capture scrolls nested content and rejects hidden, missing and obscured text', async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await page.setContent(
      '<div style="height:350px;overflow:auto;width:700px"><div style="height:900px">Верх</div><p>Бонус <strong>100 тенге</strong> за депозит</p><div style="height:600px">Низ</div></div><p style="display:none">Скрытая ставка</p>',
    );
    const bounds = await locateVisibleQuote(page, 'Бонус 100 тенге за депозит');
    assert.ok(bounds);
    assert.ok(bounds.width > 50);
    assert.ok(bounds.height < 200);
    assert.equal(await locateVisibleQuote(page, 'Бонус 1000 тенге за депозит'), null);
    assert.equal(await locateVisibleQuote(page, 'Скрытая ставка'), null);
    await page.evaluate(() => {
      const cover = document.createElement('div');
      cover.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999';
      document.body.append(cover);
    });
    assert.equal(await locateVisibleQuote(page, 'Бонус 100 тенге за депозит'), null);
  } finally {
    await browser.close();
  }
});
test('browser collection loads more than 60 scripts with bounded concurrency, blocks POST and retains public-fetch injection', async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const context = await browser.newContext();
    let active = 0,
      peak = 0,
      calls = 0;
    const stats = await installBrowserNetworkPolicy(context, undefined, async (url) => {
      active++;
      peak = Math.max(peak, active);
      calls++;
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        const body = url.endsWith('/')
          ? '<body>Сайт' +
            Array.from({ length: 80 }, (_, i) => `<script src="/script${i}.js"></script>`).join(
              '',
            ) +
            '</body>'
          : `document.body.dataset.loaded=String(Number(document.body.dataset.loaded||0)+1);`;
        return {
          body: Buffer.from(body),
          status: 200,
          url,
          redirects: [],
          headers: { 'content-type': url.endsWith('/') ? 'text/html' : 'application/javascript' },
        };
      } finally {
        active--;
      }
    });
    const page = await context.newPage();
    await page.goto('https://fixture.example/', { waitUntil: 'load' });
    assert.equal(await page.locator('body').getAttribute('data-loaded'), '80');
    assert.ok(calls >= 81);
    assert.ok(peak <= 12);
    await page.evaluate(() => fetch('/write', { method: 'POST' }).catch(() => {}));
    assert.ok(stats.blocked >= 1);
  } finally {
    await browser.close();
  }
});
