import { chromium } from 'playwright';
import type { CaseRecord, Evidence } from '../../shared/types.ts';
import type { CollectionStorage } from './contracts.ts';
import { browserOptions } from './browser-options.ts';
import { installBrowserNetworkPolicy } from './install-browser-network-policy.ts';
import { issue, saveText } from './text-evidence.ts';

export async function captureBrowserSource(
  store: CollectionStorage,
  c: CaseRecord,
  original: Evidence,
  sourceUrl: string,
) {
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
    await installBrowserNetworkPolicy(context);
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 22000 });
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
    const text = await page.locator('body').innerText();
    const dom = await page.content();
    const domFile = await store.addEvidence(c, Buffer.from(dom), {
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
      await saveText(store, c, domFile, text, 'playwright-innerText');
    }
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const screenshot = await page.screenshot({
      fullPage: height <= 16000,
      type: 'png',
      timeout: 12000,
    });
    await store.addEvidence(c, screenshot, {
      name: 'page.png',
      mime: 'image/png',
      kind: 'snapshot',
      method: 'playwright-screenshot',
      parentId: domFile.id,
    });
    const finalUrl = page.url();
    await store.addEvidence(
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
    await store.save(c);
  }
}
