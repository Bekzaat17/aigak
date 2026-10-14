import type { BrowserContext } from 'playwright';
import { safeFetch } from '../network.ts';

export async function installBrowserNetworkPolicy(
  context: BrowserContext,
  signal?: AbortSignal,
  fetcher: typeof safeFetch = safeFetch,
) {
  const stats = {
    requested: 0,
    blocked: 0,
    failed: 0,
    bytes: 0,
    errors: {} as Record<string, number>,
  };
  const controller = new AbortController();
  context.on('close', () => controller.abort());
  const activeSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const deadline = Date.now() + 90000;
  let active = 0;
  const waiting: (() => void)[] = [];
  await context.routeWebSocket('**/*', (ws) => ws.close());
  await context.route('**/*', async (route) => {
    stats.requested++;
    if (activeSignal.aborted || stats.requested > 600 || route.request().method() !== 'GET') {
      stats.blocked++;
      await route.abort().catch(() => {});
      return;
    }
    if (active >= 12) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      if (activeSignal.aborted || Date.now() > deadline || stats.bytes >= 100 * 1024 * 1024) {
        stats.blocked++;
        await route.abort();
        return;
      }
      const fetch = () =>
        fetcher(route.request().url(), 8 * 1024 * 1024, 5, activeSignal, route.request().headers());
      const response = await fetch().catch(async (error) => {
        if (error instanceof Error && error.message === 'FETCH_TIMEOUT' && Date.now() < deadline)
          return fetch();
        throw error;
      });
      stats.bytes += response.body.length;
      if (stats.bytes > 100 * 1024 * 1024) {
        stats.blocked++;
        await route.abort();
        return;
      }
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers))
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
      await route.fulfill({ status: response.status, headers, body: response.body });
    } catch (error) {
      stats.failed++;
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : 'REQUEST_FAILED';
      stats.errors[code] = (stats.errors[code] || 0) + 1;
      await route.abort().catch(() => {});
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  });
  return stats;
}
