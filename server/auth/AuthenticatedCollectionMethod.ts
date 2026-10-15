import type { Page } from 'playwright';
import type { BrowserSession } from '../collection/browser/contracts';
import type { CaseRecord } from '../../shared/types';
import type { CollectionStorage, UrlCollectionMethod } from '../collection/contracts';
import type { BrowserSessionFactory } from '../collection/browser/contracts';
import type { AuthProfile } from './contracts';
import { BrowserAuthenticationAgent } from './BrowserAuthenticationAgent';
import { CaseBrowserSessions } from './CaseBrowserSessions';
import { sanitizedDom } from './sanitized-dom';
import { saveText } from '../collection/text-evidence';
import { capturePageScreenshots } from '../collection/capture-page-screenshots';
import { StorageFailure } from '../application/errors/StorageFailure';

export class AuthenticatedCollectionMethod implements UrlCollectionMethod {
  readonly id = 'authenticated-browser';
  readonly proOnly = true;
  readonly timeoutMs = 110000;
  constructor(
    private readonly store: Pick<CollectionStorage, 'addEvidence' | 'save'>,
    private readonly profiles: readonly AuthProfile[],
    private readonly agent: Pick<BrowserAuthenticationAgent, 'authenticate'>,
    private readonly open: BrowserSessionFactory,
    private readonly sessions: CaseBrowserSessions,
    private readonly interactions:
      | { requestCode(caseId: string, signal: AbortSignal): Promise<string | undefined> }
      | undefined = undefined,
    private readonly automatic?: {
      prepare(
        id: string,
        url: string,
        page: Page,
        observe: BrowserSession['observe'],
        signal: AbortSignal,
        onAction: (a: import('../../shared/agent-run').AgentAction) => void,
      ): Promise<AuthProfile>;
    },
    private readonly sessionLifetimeMs = 900000,
  ) {}
  supports(c: CaseRecord) {
    return !!c.authenticationRequest;
  }
  async collect(c: CaseRecord, signal: AbortSignal) {
    if (!c.authenticationRequest) return;
    const start = Date.now();
    const request = c.authenticationRequest;
    const report = (c.authentication = {
      status: 'failed',
      mode: request.mode,
      checkedAt: new Date().toISOString(),
      evidenceIds: [],
      durationMs: 0,
    } as NonNullable<CaseRecord['authentication']>);
    let profile = this.profiles.find(
      (p) => p.id === request.profileId && p.origin === new URL(c.sourceUrl!).origin,
    );
    if (
      !profile &&
      !(request.profileId === 'automatic' && request.mode === 'register' && this.automatic)
    ) {
      report.reason = 'PROFILE_UNAVAILABLE';
      return;
    }
    if (request.mode === 'register' && c.registrationAttempted) {
      report.reason = 'REGISTRATION_ALREADY_ATTEMPTED';
      report.status = 'action_required';
      return;
    }
    const session = await this.open(AbortSignal.timeout(this.sessionLifetimeMs), {
      width: 1440,
      height: 1000,
    });
    const abort = () => {
      void session.close();
    };
    signal.addEventListener('abort', abort, { once: true });
    let kept = false;
    try {
      signal.throwIfAborted();
      const page = await session.context.newPage();
      if (!profile && this.automatic)
        profile = await this.automatic.prepare(
          'automatic-' + c.id,
          c.sourceUrl!,
          page,
          session.observe,
          signal,
          (a) => c.scenarioRun?.actions.push(a),
        );
      if (!profile) throw Error('PROFILE_UNAVAILABLE');
      const activeProfile = profile;
      const form = request.mode === 'register' ? profile.register : profile.login;
      let submitting = true;
      let submissions = 0;
      await session.context.route('**/*', async (route) => {
        const r = route.request();
        const url = new URL(r.url());
        if (r.method() === 'POST') {
          if (
            submitting &&
            ++submissions <= 8 &&
            url.origin === activeProfile.origin &&
            (form?.submitUrls.includes(url.href) ||
              (form?.accountEndpoints &&
                /\/(?:auth|login|register|registration|signup|session|verify)(?:\/|$)/i.test(
                  url.pathname,
                )))
          )
            await route.continue();
          else await route.abort();
        } else await route.fallback();
      });
      if (request.mode === 'register') {
        c.registrationAttempted = true;
        await this.store.save(c);
      }
      const detectedSecrets: string[] = [];
      const authenticated = await this.agent.authenticate(page, profile, request.mode, signal, {
        observe: session.observe,
        requestCode: this.interactions ? (s) => this.interactions!.requestCode(c.id, s) : undefined,
        onAction: (a) => c.scenarioRun?.actions.push(a),
        onSecret: (value) => detectedSecrets.push(value),
      });
      submitting = false;
      if (!authenticated) {
        report.status = 'action_required';
        report.reason = 'EMAIL_OR_2FA_REQUIRED';
        return;
      }
      report.status = 'authenticated';
      if (!profile.readUrls.length) {
        const destination = new URL(page.url());
        profile.readUrls = [
          /verify|confirm|activate/i.test(destination.pathname)
            ? profile.origin + '/'
            : destination.origin + destination.pathname,
        ];
      }
      for (const url of profile.readUrls) {
        signal.throwIfAborted();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (
          new URL(page.url()).origin !== profile.origin ||
          !(await page.locator(profile.successSelector).isVisible())
        ) {
          report.status = 'action_required';
          report.reason = 'AUTH_NOT_CONFIRMED';
          break;
        }
        const text = await page.locator('body').innerText();
        const secrets = [
          ...detectedSecrets,
          ...Object.entries(form?.fields || {})
            .filter(([selector]) => /pass|secret/i.test(selector))
            .map(([, value]) => value),
        ];
        if (secrets.some((value) => text.includes(value))) throw Error('SECRET_VISIBLE');
        let html = await sanitizedDom(page);
        for (const value of secrets) html = html.replaceAll(value, '[secret removed]');
        const dom = await this.store.addEvidence(c, Buffer.from(html), {
          name: 'authenticated-page.html',
          mime: 'text/html',
          kind: 'snapshot',
          method: 'authenticated-dom',
          sourceUrl: page.url(),
          access: 'authenticated',
        });
        await saveText(this.store, c, dom, text, 'authenticated-innerText');
        const derived = c.evidence.find((e) => e.parentId === dom.id && e.kind === 'text');
        if (derived) {
          derived.access = 'authenticated';
          await capturePageScreenshots(page, this.store, c, dom, derived, 'authenticated');
        }
        const captured = c.evidence.filter((e) => e.id === dom.id || e.parentId === dom.id);
        for (const e of captured) {
          e.access = 'authenticated';
          report.evidenceIds.push(e.id);
        }
      }
      this.sessions.set(c.id, { ...session, page, profile, secrets: detectedSecrets });
      kept = true;
    } catch (error) {
      if (
        error instanceof StorageFailure ||
        (error instanceof Error && error.message === 'CASE_CONFLICT')
      )
        throw error;
      report.status = 'failed';
      report.reason = 'ACCESS_FAILED';
      signal.throwIfAborted();
    } finally {
      report.durationMs = Date.now() - start;
      signal.removeEventListener('abort', abort);
      if (!kept) await session.close();
    }
  }
}
