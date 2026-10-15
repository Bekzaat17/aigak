import { chromium } from 'playwright';
import { browserOptions } from '../browser-options';
import { installBrowserNetworkPolicy } from '../install-browser-network-policy';
import type { BrowserSessionFactory } from './contracts';
export const openInterceptedSession: BrowserSessionFactory = async (signal, viewport) => {
  signal.throwIfAborted();
  const browser = await chromium.launch(browserOptions());
  const abort = () => {
    void browser.close().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    const context = await browser.newContext({
      viewport,
      locale: 'ru-RU',
      timezoneId: 'Asia/Almaty',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    await installBrowserNetworkPolicy(context, signal);
    return {
      context,
      close: async () => {
        signal.removeEventListener('abort', abort);
        await browser.close().catch(() => {});
      },
    };
  } catch (error) {
    signal.removeEventListener('abort', abort);
    await browser.close().catch(() => {});
    throw error;
  }
};
