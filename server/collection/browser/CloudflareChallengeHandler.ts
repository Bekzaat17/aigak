import type { Page } from 'playwright';
import type { AgentAction } from '../../../shared/agent-run';
import { pageTextQuality } from '../../../shared/collection';

/** Bounded interaction with the actual verification widget; success requires target content. */
export class CloudflareChallengeHandler {
  constructor(
    private readonly budgetMs = 20000,
    private readonly authorize: (page: Page) => () => void = () => () => {},
  ) {}
  async prepare(page: Page, signal: AbortSignal, onAction?: (action: AgentAction) => void) {
    const challenged = async () =>
      /^(just a moment|один момент)/i.test(await page.title()) ||
      (await page.locator('#challenge-running, #challenge-stage, #challenge-form').count()) > 0;
    if (!(await challenged())) return;
    const release = this.authorize(page);
    const start = Date.now();
    const entry: AgentAction = {
      role: 'access-verifier',
      action: 'cloudflare-challenge',
      status: 'failed',
      reason: 'CAPTCHA_REQUIRED',
      startedAt: new Date(start).toISOString(),
      durationMs: 0,
    };
    onAction?.(entry);
    const clicked = new Set<string>();
    try {
      while (Date.now() - start < this.budgetMs) {
        signal.throwIfAborted();
        if (!(await challenged())) {
          const text = await page.locator('body').innerText({ timeout: 2000 });
          if (pageTextQuality(text) === 'adequate') {
            entry.status = 'completed';
            entry.reason = 'CHALLENGE_PASSED';
            return;
          }
        }
        for (const frame of page.frames()) {
          let url: URL;
          try {
            url = new URL(frame.url());
          } catch {
            continue;
          }
          if (url.origin !== 'https://challenges.cloudflare.com' || clicked.has(frame.url()))
            continue;
          if (frame.isDetached()) continue;
          const checkbox = frame.locator('input[type="checkbox"]');
          if (
            (await checkbox.count().catch(() => 0)) === 1 &&
            (await checkbox.isVisible().catch(() => false))
          ) {
            clicked.add(frame.url());
            await checkbox.click({ timeout: 2000 }).catch(() => {});
          }
        }
        await page.waitForTimeout(500);
      }
      throw Error('CAPTCHA_REQUIRED');
    } finally {
      release();
      entry.durationMs = Date.now() - start;
    }
  }
}
