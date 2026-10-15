import { PublicPagePostPolicy, type PublicPagePostRule } from './PublicPagePostPolicy';
import { ChallengeNavigationPolicy } from './ChallengeNavigationPolicy';
import { CloudflareChallengeHandler } from './CloudflareChallengeHandler';
import type { BrowserContext, LaunchOptions } from 'playwright';
import { PublicEgressProxy } from './PublicEgressProxy';
import { browserOptions } from '../browser-options';
import { installNativeNetworkPolicy } from './native-network-policy';
import type { BrowserSessionFactory } from './contracts';

export function createNativeSession(
  openBrowser: (
    options: LaunchOptions,
    viewport: { width: number; height: number },
  ) => Promise<{ context: BrowserContext; close(): Promise<void> }>,
  postRules: readonly PublicPagePostRule[] = [],
): BrowserSessionFactory {
  return async (signal, viewport) => {
    signal.throwIfAborted();
    const proxy = new PublicEgressProxy();
    const endpoint = await proxy.start();
    let browser;
    try {
      browser = await openBrowser(
        {
          ...browserOptions(),
          proxy: { server: endpoint, bypass: '<-loopback>' },
          args: ['--disable-quic'],
        },
        viewport,
      );
      const context = browser.context;
      const navigation = new ChallengeNavigationPolicy();
      await installNativeNetworkPolicy(
        context,
        signal,
        navigation,
        new PublicPagePostPolicy(postRules),
      );
      let closing: Promise<void> | undefined;
      const close = async () => {
        closing ??= (async () => {
          signal.removeEventListener('abort', abort);
          await browser!.close().catch(() => {});
          await proxy.close();
        })();
        await closing;
      };
      const abort = () => {
        void close();
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        await close();
        signal.throwIfAborted();
      }
      return {
        context,
        close,
        preparePage: (page, onAction) =>
          new CloudflareChallengeHandler(40000, (p) => navigation.authorize(p)).prepare(
            page,
            signal,
            onAction,
          ),
      };
    } catch (error) {
      await browser?.close().catch(() => {});
      await proxy.close();
      throw error;
    }
  };
}
