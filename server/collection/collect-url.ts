import { load } from 'cheerio';
import { chromium } from 'playwright';
import type { CaseRecord } from '../../shared/types.ts';
import { safeFetch } from '../network.ts';
import { Store } from '../storage/Store.ts';
import { browserOptions } from './browser-options.ts';
import { detectMime } from './detect-mime.ts';
import { extractFile } from './extract-file.ts';
import { issue, saveText } from './text-evidence.ts';

export async function collectUrl(store: Store, c: CaseRecord) {
  const result = await safeFetch(c.sourceUrl!);
  c.redirects = result.redirects;
  const declared = String(result.headers['content-type'] || '').split(';')[0];
  const mime =
    declared === 'text/html' ? 'text/html' : detectMime(result.body, new URL(result.url).pathname);
  const ext = mime === 'text/html' ? 'html' : mime === 'application/pdf' ? 'pdf' : 'bin';
  const original = store.addEvidence(c, result.body, {
    name: `response.${ext}`,
    mime,
    kind: 'original',
    method: 'http-get',
    sourceUrl: result.url,
  });
  store.addEvidence(
    c,
    Buffer.from(
      JSON.stringify(
        {
          requestedUrl: c.sourceUrl,
          finalUrl: result.url,
          status: result.status,
          headers: result.headers,
          redirects: result.redirects,
          receivedAt: original.createdAt,
        },
        null,
        2,
      ),
    ),
    {
      name: 'http-metadata.json',
      mime: 'application/json',
      kind: 'metadata',
      method: 'http-get',
      parentId: original.id,
    },
  );
  if (result.status >= 400)
    issue(
      c,
      `Сервер вернул HTTP ${result.status}; содержимое может быть страницей ошибки.`,
      `Сервер HTTP ${result.status} қайтарды; мазмұн қате беті болуы мүмкін.`,
    );
  await extractFile(store, c, original);
  if (mime !== 'text/html') return;
  const $ = load(result.body.toString());
  c.links = [
    ...new Set(
      $('a[href]')
        .map((_, a) => {
          try {
            const u = new URL($(a).attr('href')!, result.url);
            return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
          } catch {
            return '';
          }
        })
        .get()
        .filter(Boolean),
    ),
  ].slice(0, 30);
  // Links are leads, not evidence about those destinations. Never auto-follow them.
  let browser;
  try {
    browser = await chromium.launch(browserOptions());
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'ru-RU',
      timezoneId: 'Asia/Almaty',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    let requestCount = 0;
    let totalBytes = 0;
    const deadline = Date.now() + 30000;
    await context.routeWebSocket('**/*', (ws) => ws.close());
    await context.route('**/*', async (route) => {
      try {
        if (
          Date.now() > deadline ||
          ++requestCount > 60 ||
          totalBytes > 30 * 1024 * 1024 ||
          route.request().method() !== 'GET'
        )
          return void (await route.abort());
        const r = await safeFetch(route.request().url(), 4 * 1024 * 1024);
        totalBytes += r.body.length;
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(r.headers))
          if (
            value &&
            ![
              'content-encoding',
              'content-length',
              'transfer-encoding',
              'connection',
              'set-cookie',
              'location',
            ].includes(key)
          )
            headers[key] = Array.isArray(value) ? value.join(', ') : value;
        await route.fulfill({ status: r.status, headers, body: r.body });
      } catch {
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(result.url, { waitUntil: 'domcontentloaded', timeout: 22000 });
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
    const text = await page.locator('body').innerText();
    const dom = await page.content();
    const domFile = store.addEvidence(c, Buffer.from(dom), {
      name: 'rendered.html',
      mime: 'text/html',
      kind: 'snapshot',
      method: 'playwright-dom',
      parentId: original.id,
      sourceUrl: page.url(),
    });
    // Prefer rendered text, keeping the HTTP text in the archive but avoiding duplicate findings.
    if (text.trim()) {
      for (const e of c.evidence)
        if (e.kind === 'text' && e.parentId === original.id) delete e.text;
      saveText(store, c, domFile, text, 'playwright-innerText');
    }
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const screenshot = await page.screenshot({
      fullPage: height <= 16000,
      type: 'png',
      timeout: 12000,
    });
    store.addEvidence(c, screenshot, {
      name: 'page.png',
      mime: 'image/png',
      kind: 'snapshot',
      method: 'playwright-screenshot',
      parentId: domFile.id,
    });
    const finalUrl = page.url();
    store.addEvidence(
      c,
      Buffer.from(
        JSON.stringify(
          {
            url: finalUrl,
            capturedAt: new Date().toISOString(),
            viewport: { width: 1440, height: 1000 },
            fullPage: height <= 16000,
            browserVersion: browser.version(),
            locale: 'ru-RU',
            timezone: 'Asia/Almaty',
            networkPolicy: 'public HTTP GET, no cookies, no WebSockets; 60 requests / 30 MiB',
          },
          null,
          2,
        ),
      ),
      {
        name: 'browser-metadata.json',
        mime: 'application/json',
        kind: 'metadata',
        method: 'playwright',
        parentId: domFile.id,
      },
    );
    issue(
      c,
      'Браузерная фиксация ограничивает сетевые запросы; часть динамического содержимого может отсутствовать.',
      'Браузерлік тіркеу желілік сұрауларды шектейді; динамикалық мазмұнның бір бөлігі болмауы мүмкін.',
    );
    if (height > 16000)
      issue(
        c,
        'Очень длинная страница: сохранён снимок первого экрана.',
        'Өте ұзын бет: бірінші экранның суреті сақталды.',
      );
  } catch {
    issue(
      c,
      'Браузерный снимок не получен. HTTP-оригинал сохранён; для сложной страницы загрузите скриншот вручную.',
      'Браузер суреті алынбады. HTTP түпнұсқасы сақталды; күрделі бет үшін скриншотты қолмен жүктеңіз.',
    );
  } finally {
    await browser?.close();
    store.save(c);
  }
}
