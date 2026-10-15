import type { ChallengeNavigationPolicy } from './ChallengeNavigationPolicy';
import type { BrowserContext } from 'playwright';
import { parsePublicUrl } from '../../network';
import { isChallengeRequest } from './challenge-request';
export async function installNativeNetworkPolicy(
  context: BrowserContext,
  signal: AbortSignal,
  navigation?: Pick<ChallengeNavigationPolicy, 'allows'>,
  publicPosts?: Pick<ChallengeNavigationPolicy, 'allows'>,
) {
  let requests = 0;
  let challengeRequests = 0;
  await context.routeWebSocket('**/*', (ws) => ws.close());
  await context.route('**/*', async (route) => {
    try {
      const url = parsePublicUrl(route.request().url());
      const request = route.request();
      const challenge =
        request.method() === 'POST' &&
        challengeRequests < 16 &&
        isChallengeRequest(
          url,
          request.frame().page().url(),
          request.postDataBuffer()?.length || 0,
        );
      if (challenge) challengeRequests++;
      if (
        signal.aborted ||
        ++requests > 800 ||
        (request.method() !== 'GET' &&
          !challenge &&
          !navigation?.allows(request) &&
          !publicPosts?.allows(request)) ||
        url.protocol !== 'https:'
      )
        return await route.abort();
      await route.continue();
    } catch {
      await route.abort().catch(() => {});
    }
  });
}
