import type { Page } from 'playwright';
import type { AuthProfile, VerificationInbox } from './contracts';

/** Configured form actions, bounded transitions, positive success signal. No arbitrary agent clicks. */
export class BrowserAuthenticationAgent {
  constructor(private readonly inbox: VerificationInbox) {}
  async authenticate(
    page: Page,
    profile: AuthProfile,
    mode: 'login' | 'register',
    signal: AbortSignal,
  ) {
    const form = mode === 'register' ? profile.register : profile.login;
    if (!form || (mode === 'register' && !profile.registration)) throw Error('PROFILE_UNAVAILABLE');
    signal.throwIfAborted();
    await page.goto(form.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (new URL(page.url()).origin !== profile.origin) throw Error('AUTH_ORIGIN_CHANGED');
    for (const [selector, value] of Object.entries(form.fields)) {
      signal.throwIfAborted();
      if (new URL(page.url()).origin !== profile.origin) throw Error('AUTH_ORIGIN_CHANGED');
      await page.locator(selector).fill(value, { timeout: 10000 });
    }
    await page.locator(form.submitSelector).click({ timeout: 10000 });
    try {
      await page.locator(profile.successSelector).waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      if (mode === 'register') {
        const link = await this.inbox.waitForLink(profile, signal);
        if (link) {
          const url = new URL(link);
          if (
            url.origin !== profile.origin ||
            !profile.verification ||
            !url.pathname.startsWith(profile.verification.allowedPathPrefix)
          )
            throw Error('VERIFICATION_LINK_REJECTED');
          await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.goto(profile.readUrls[0], { waitUntil: 'domcontentloaded', timeout: 20000 });
        }
      }
    }
    signal.throwIfAborted();
    return (
      new URL(page.url()).origin === profile.origin &&
      (await page.locator(profile.successSelector).isVisible())
    );
  }
}
