import type { BrowserSession } from '../collection/browser/contracts';
import type { AgentAction } from '../../shared/agent-run';
import { findAuthControl } from '../ai/prompts/browser-agent';
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
    options?: {
      observe?: BrowserSession['observe'];
      onAction?: (action: AgentAction) => void;
      onSecret?: (value: string) => void;
      requestCode?: (signal: AbortSignal) => Promise<string | undefined>;
    },
  ) {
    const form = mode === 'register' ? profile.register : profile.login;
    if (!form || (mode === 'register' && !profile.registration)) throw Error('PROFILE_UNAVAILABLE');
    signal.throwIfAborted();
    if (!form.preservePage || page.url() !== form.url)
      await page.goto(form.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (new URL(page.url()).origin !== profile.origin) throw Error('AUTH_ORIGIN_CHANGED');
    const locate = async (selector: string, hint: string) => {
      if (
        (await page.locator(selector).count()) === 1 &&
        (await page.locator(selector).isVisible())
      )
        return selector;
      if (!options?.observe) throw Error('AUTH_CONTROL_NOT_FOUND');
      const actions = await options.observe(page, findAuthControl(hint), options.onAction);
      if (actions.length !== 1) throw Error('AUTH_CONTROL_AMBIGUOUS');
      const found = page.locator(actions[0].selector);
      if ((await found.count()) !== 1 || !(await found.isVisible()))
        throw Error('AUTH_CONTROL_NOT_FOUND');
      return actions[0].selector;
    };
    // Plan every control before filling: no credential value is sent to the model.
    const fields: { selector: string; value: string }[] = [];
    for (const [selector, value] of Object.entries(form.fields))
      fields.push({
        selector: await locate(selector, form.fieldHints?.[selector] || selector),
        value,
      });
    const submit = await locate(
      form.submitSelector,
      mode === 'register' ? 'Register / create account submit button' : 'Log in submit button',
    );
    for (const { selector, value } of fields) {
      signal.throwIfAborted();
      if (new URL(page.url()).origin !== profile.origin) throw Error('AUTH_ORIGIN_CHANGED');
      const field = page.locator(selector);
      const destination = await field.evaluate((e) => {
        const form = (e as HTMLInputElement).form;
        return form ? { origin: new URL(form.action).origin, method: form.method } : null;
      });
      if (
        destination &&
        (destination.origin !== profile.origin || destination.method.toLowerCase() !== 'post')
      )
        throw Error('AUTH_FORM_DESTINATION_REJECTED');
      const type = await field.getAttribute('type');
      if (type === 'password') options?.onSecret?.(value);
      await field.fill(value, { timeout: 5000 });
    }
    await page.locator(submit).click({ timeout: 10000 });
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
          if (profile.readUrls[0])
            await page.goto(profile.readUrls[0], { waitUntil: 'domcontentloaded', timeout: 20000 });
        }
      }
    }
    if (
      new URL(page.url()).origin === profile.origin &&
      !(await page.locator(profile.successSelector).isVisible())
    ) {
      const otp = page.locator(
        'input[autocomplete="one-time-code"]:visible,input[name="otp"]:visible,input[name="code"]:visible',
      );
      if ((await otp.count()) === 1 && options?.requestCode) {
        const code = await options.requestCode(signal);
        if (code) {
          options.onSecret?.(code);
          await otp.fill(code);
          const button = page.locator('button[type="submit"]:visible,input[type="submit"]:visible');
          if ((await button.count()) === 1) {
            await button.click({ timeout: 5000 });
            await page
              .locator(profile.successSelector)
              .waitFor({ state: 'visible', timeout: 8000 })
              .catch(() => {});
          }
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
