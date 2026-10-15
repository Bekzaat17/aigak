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

test('native and Patchright session adapters preserve capture, cancellation and write restrictions', async () => {
  const { openNativeSession } = await import('../server/collection/browser/open-native-session');
  const { openPatchrightSession } =
    await import('../server/collection/browser/open-patchright-session');
  for (const open of [openNativeSession, openPatchrightSession]) {
    const controller = new AbortController();
    const session = await open(controller.signal, { width: 800, height: 600 });
    try {
      const page = await session.context.newPage();
      await page.setContent('<p>Exact visible evidence</p>');
      assert.ok(await locateVisibleQuote(page, 'Exact visible evidence'));
      assert.ok((await page.screenshot()).length > 0);
      await session.preparePage?.(page);
      const allowed = await page.evaluate(async () => {
        try {
          await fetch('https://example.com/deposit', { method: 'POST' });
          return true;
        } catch {
          return false;
        }
      });
      assert.equal(allowed, false);
      controller.abort();
      await session.close();
      assert.equal(page.isClosed(), true);
    } finally {
      await session.close();
    }
  }
});

test('challenge gate waits for target content, rejects unresolved checks and records outcome', async () => {
  const { CloudflareChallengeHandler } =
    await import('../server/collection/browser/CloudflareChallengeHandler');
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<title>Один момент…</title><form id="challenge-form">Verification</form>',
    );
    await assert.rejects(
      new CloudflareChallengeHandler(20).prepare(page, new AbortController().signal),
      /CAPTCHA_REQUIRED/,
    );
    await page.evaluate(() => {
      setTimeout(() => {
        document.title = 'Target';
        document.body.innerHTML =
          '<p>' + 'Actual target content and evidence. '.repeat(25) + '</p>';
      }, 100);
    });
    const actions: import('../shared/agent-run').AgentAction[] = [];
    await new CloudflareChallengeHandler(2000).prepare(page, new AbortController().signal, (a) =>
      actions.push(a),
    );
    assert.equal(actions[0].reason, 'CHALLENGE_PASSED');
    assert.equal(actions[0].status, 'completed');
  } finally {
    await browser.close();
  }
});

test('challenge navigation grant cannot authorize account forms and expires after release', async () => {
  const { ChallengeNavigationPolicy } =
    await import('../server/collection/browser/ChallengeNavigationPolicy');
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    const policy = new ChallengeNavigationPolicy();
    const outcomes: boolean[] = [];
    await page.route('https://fixture.example/**', async (route) => {
      if (route.request().method() === 'POST') {
        outcomes.push(policy.allows(route.request()));
        await route.fulfill({ status: 200, body: '<body>Done</body>' });
      } else await route.fulfill({ status: 200, body: '<body>Fixture</body>' });
    });
    await page.goto('https://fixture.example/');
    const release = policy.authorize(page);
    for (const name of ['password', 'a'.repeat(64)]) {
      await page.evaluate((name) => {
        const form = document.createElement('form');
        form.method = 'POST';
        const input = document.createElement('input');
        input.name = name;
        input.value = 'fixture';
        form.append(input);
        document.body.append(form);
        form.submit();
      }, name);
      await page.waitForURL('https://fixture.example/', { waitUntil: 'load' });
      await page.waitForTimeout(100);
    }
    release();
    await page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      const input = document.createElement('input');
      input.name = 'a'.repeat(64);
      input.value = 'fixture';
      form.append(input);
      document.body.append(form);
      form.submit();
    });
    await page.waitForTimeout(100);
    assert.deepEqual(outcomes, [false, true, false]);
  } finally {
    await browser.close();
  }
});

test('public-page POST rules restrict endpoint, content type, body size and request count', async () => {
  const { PublicPagePostPolicy } =
    await import('../server/collection/browser/PublicPagePostPolicy');
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage();
    const policy = new PublicPagePostPolicy([
      {
        origin: 'https://fixture.example',
        path: '/telemetry',
        contentType: 'text/plain',
        maxBytes: 10,
        maxRequests: 1,
      },
    ]);
    const outcomes: boolean[] = [];
    await page.route('https://fixture.example/**', async (route) => {
      if (route.request().method() === 'POST') outcomes.push(policy.allows(route.request()));
      await route.fulfill({ status: 200, body: '<body>Fixture</body>' });
    });
    await page.goto('https://fixture.example/');
    await page.evaluate(async () => {
      await fetch('/payment', { method: 'POST', body: 'data' });
      await fetch('/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      await fetch('/telemetry', { method: 'POST', body: 'x'.repeat(11) });
      await fetch('/telemetry', { method: 'POST', body: 'data' });
      await fetch('/telemetry', { method: 'POST', body: 'data' });
    });
    assert.deepEqual(outcomes, [false, false, false, true, false]);
  } finally {
    await browser.close();
  }
});
