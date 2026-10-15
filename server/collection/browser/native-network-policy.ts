import type { BrowserContext } from 'playwright';
import { parsePublicUrl } from '../../network';
export async function installNativeNetworkPolicy(context: BrowserContext, signal: AbortSignal) {
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
}
