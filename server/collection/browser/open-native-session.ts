import { chromium } from 'playwright';
import { PublicEgressProxy } from './PublicEgressProxy';
import { browserOptions } from '../browser-options';
import { parsePublicUrl } from '../../network';
import type { BrowserSessionFactory } from './contracts';

export const openNativeSession: BrowserSessionFactory = async (signal, viewport) => {
  signal.throwIfAborted();
  const proxy = new PublicEgressProxy();
  const endpoint = await proxy.start();
  let browser;
  try {
    browser = await chromium.launch({
      ...browserOptions(),
      proxy: { server: endpoint, bypass: '<-loopback>' },
      args: ['--disable-quic'],
    });
    const context = await browser.newContext({
      viewport,
      locale: 'ru-RU',
      timezoneId: 'Asia/Almaty',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    let requests = 0;
    await context.routeWebSocket('**/*', (ws) => ws.close());
    await context.route('**/*', async (route) => {
      try {
        const url = parsePublicUrl(route.request().url());
        if (
          signal.aborted ||
          ++requests > 800 ||
          route.request().method() !== 'GET' ||
          url.protocol !== 'https:'
        )
          return await route.abort();
        await route.continue();
      } catch {
        await route.abort().catch(() => {});
      }
    });
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      signal.removeEventListener('abort', abort);
      await browser!.close().catch(() => {});
      await proxy.close();
    };
    const abort = () => {
      void close();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      await close();
      signal.throwIfAborted();
    }
    return { context, close };
  } catch (error) {
    await browser?.close().catch(() => {});
    await proxy.close();
    throw error;
  }
};
