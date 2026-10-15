import { chromium } from 'playwright';
import { PublicEgressProxy } from './PublicEgressProxy';
import { browserOptions } from '../browser-options';
import { installNativeNetworkPolicy } from './native-network-policy';
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
    await installNativeNetworkPolicy(context, signal);
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
