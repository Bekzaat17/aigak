import type { BrowserContext } from 'playwright';
import { safeFetch } from '../network.ts';

export async function installBrowserNetworkPolicy(context: BrowserContext): Promise<void> {
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
}
