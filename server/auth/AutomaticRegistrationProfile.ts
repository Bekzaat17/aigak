import type { Page } from 'playwright';
import type { AuthProfile } from './contracts';
import type { BrowserSession } from '../collection/browser/contracts';
import type { AgentAction } from '../../shared/agent-run';
import { findAuthControl } from '../ai/prompts/browser-agent';

/** Discovers only a same-origin email registration form; unsupported identity fields fail closed. */
export class AutomaticRegistrationProfile {
  constructor(
    private readonly mailbox: {
      create(id: string, signal: AbortSignal): Promise<{ address: string; password: string }>;
    },
  ) {}
  async prepare(
    id: string,
    url: string,
    page: Page,
    observe: BrowserSession['observe'],
    signal: AbortSignal,
    onAction: (action: AgentAction) => void,
  ): Promise<AuthProfile> {
    const origin = new URL(url).origin;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (new URL(page.url()).origin !== origin) throw Error('AUTH_ORIGIN_CHANGED');
    if (!/register|registration|sign.?up|регистрац/i.test(page.url())) {
      if (!observe) throw Error('BROWSER_AGENT_UNAVAILABLE');
      const actions = await observe(
        page,
        findAuthControl('Link or non-submit button to open account registration / sign up'),
        onAction,
      );
      if (actions.length !== 1) throw Error('REGISTRATION_FORM_NOT_FOUND');
      const node = page.locator(actions[0].selector);
      const target = await node.evaluate((e) => ({
        href: e instanceof HTMLAnchorElement ? e.href : '',
        safeButton: e instanceof HTMLButtonElement && !e.form,
      }));
      if (target.href && new URL(target.href).origin === origin)
        await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      else if (target.safeButton) await node.click({ timeout: 5000 });
      else throw Error('REGISTRATION_CONTROL_REJECTED');
    }
    signal.throwIfAborted();
    if (new URL(page.url()).origin !== origin) throw Error('AUTH_ORIGIN_CHANGED');
    const email = page.locator('input[type="email"]:visible');
    const passwords = page.locator('input[type="password"]:visible');
    if (
      (await email.count()) !== 1 ||
      (await passwords.count()) < 1 ||
      (await passwords.count()) > 2
    )
      throw Error('REGISTRATION_FORM_UNSUPPORTED');
    const formInfo = await email.evaluate((e) => {
      const form = (e as HTMLInputElement).form;
      return {
        action: form?.action || location.href,
        unsupported: [...(form?.querySelectorAll('input[required],select[required]') || [])].some(
          (n) => !['email', 'password', 'hidden', 'submit'].includes((n as HTMLInputElement).type),
        ),
      };
    });
    if (formInfo.unsupported || new URL(formInfo.action).origin !== origin)
      throw Error('REGISTRATION_REQUIRES_PERSONAL_DATA');
    const credentials = await this.mailbox.create(id, signal);
    const fields: Record<string, string> = { 'input[type="email"]:visible': credentials.address };
    for (let i = 0; i < (await passwords.count()); i++)
      fields[`input[type="password"]:visible >> nth=${i}`] = credentials.password;
    const form = {
      url: page.url(),
      fields,
      submitSelector: 'button[type="submit"]:visible,input[type="submit"]:visible',
      submitUrls: [...new Set([formInfo.action, page.url()])],
      accountEndpoints: true,
      preservePage: true,
    };
    return {
      id,
      name: 'Автоматическая регистрация',
      origin,
      registration: true,
      login: form,
      register: form,
      successSelector:
        '[data-authenticated="true"],a[href*="logout"],button:has-text("Выйти"),button:has-text("Log out")',
      readUrls: [],
      verification: {
        endpoint: 'https://api.mail.tm/messages',
        token: 'managed-in-memory',
        allowedPathPrefix: '/',
      },
    };
  }
}
