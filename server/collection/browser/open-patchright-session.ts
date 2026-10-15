import { siteRequestRules } from './site-request-rules';
import { chromium } from 'patchright';
import type { BrowserContext } from 'playwright';
import { createNativeSession } from './create-native-session';
export const openPatchrightSession = createNativeSession(async (options, viewport) => {
  const context = await chromium.launchPersistentContext('', {
    ...options,
    headless: process.platform === 'linux' && !process.env.DISPLAY,
    viewport,
    acceptDownloads: false,
    serviceWorkers: 'block',
  });
  // Drop-in API; recursive generic PageFunction types differ between the two packages.
  // Both adapters undergo the same capture, cancellation and network contract tests.
  return { context: context as unknown as BrowserContext, close: () => context.close() };
}, siteRequestRules);
