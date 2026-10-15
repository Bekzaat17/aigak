import { AdiletApiReader } from '../osint/AdiletApiReader';
import { AdiletHtmlReader } from '../osint/AdiletHtmlReader';
import { LegalCorpusStage } from '../application/processing/LegalCorpusStage';
import { openPatchrightSession } from '../collection/browser/open-patchright-session';
import { AuthenticationStage } from '../application/processing/AuthenticationStage';
import { FileAuthChallenges } from '../auth/FileAuthChallenges';
import { EvidenceSupervisor } from '../application/processing/EvidenceSupervisor';
import { MailTmInbox } from '../auth/MailTmInbox';
import { AutomaticRegistrationProfile } from '../auth/AutomaticRegistrationProfile';
import { chromium } from 'playwright';
import { createProCollector } from './create-pro-collector';
import { StagehandBrowserFactory } from '../collection/browser/StagehandBrowserFactory';
import { ScopedCaseStore } from '../application/processing/ScopedCaseStore';
import { parseAuthProfiles } from '../auth/auth-profiles';
import { AuthenticatedCollectionMethod } from '../auth/AuthenticatedCollectionMethod';
import { BrowserAuthenticationAgent } from '../auth/BrowserAuthenticationAgent';
import { VerificationInboxClient } from '../auth/VerificationInboxClient';
import { CaseBrowserSessions } from '../auth/CaseBrowserSessions';
import { openNativeSession } from '../collection/browser/open-native-session';
import { openInterceptedSession } from '../collection/browser/open-intercepted-session';
import { BrowserFindingVerifier } from '../collection/BrowserFindingVerifier.ts';
import { FindingVerificationStage } from '../application/processing/FindingVerificationStage.ts';
import { CaseProcessingService } from '../application/processing/CaseProcessingService.ts';
import { CollectionStage } from '../application/processing/CollectionStage.ts';
import { InspectionStage } from '../application/processing/InspectionStage.ts';
import { ProEnrichmentStage } from '../application/processing/ProEnrichmentStage.ts';
import { ResourceProfileStage } from '../application/processing/ResourceProfileStage.ts';
import type { ProcessingProgress } from '../application/ports/processing.ts';
import { createUrlCollector } from './create-url-collector.ts';
import type { AiAnalyzer } from '../inspection/contracts.ts';
import { createInspectionFacade } from '../inspection/index.ts';
import { DetectiveService } from '../osint/DetectiveService.ts';
import { CertificateTransparencyProvider } from '../osint/discovery/CertificateTransparencyProvider.ts';
import { ResourceInvestigator } from '../osint/discovery/ResourceInvestigator.ts';
import { createOsintFacade } from '../osint/index.ts';
import { LegalCorpusService } from '../osint/LegalCorpusService.ts';
import { OfficialSourcesService } from '../osint/OfficialSourcesService.ts';
import { collectContactPages } from '../osint/site-pages.ts';
import type { CaseStore } from '../application/ports/storage.ts';
import { createExtraction } from './create-extraction.ts';

export function createCaseProcessor(
  durableStore: CaseStore,
  dataDirectory: string,
  ai?: AiAnalyzer,
  progress?: ProcessingProgress,
) {
  const store = new ScopedCaseStore(durableStore);
  const extraction = createExtraction(store, dataDirectory);
  const agentBrowser = process.env.OPENAI_API_KEY
    ? new StagehandBrowserFactory(
        {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.BROWSER_AGENT_MODEL || process.env.OPENAI_MODEL || 'gpt-6-luna',
          executablePath:
            process.env.STAGEHAND_CHROME_PATH ||
            (process.platform === 'darwin'
              ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
              : chromium.executablePath()),
        },
        openPatchrightSession,
      ).open
    : undefined;
  const proCollector = createProCollector(store, dataDirectory, agentBrowser);
  const sessions = new CaseBrowserSessions();
  const profiles = parseAuthProfiles(process.env.AIGAK_AUTH_PROFILES);
  const mailbox = new MailTmInbox();
  const configuredInbox = new VerificationInboxClient();
  const authentication = new AuthenticatedCollectionMethod(
    store,
    profiles,
    new BrowserAuthenticationAgent({
      waitForLink: (p, signal) =>
        mailbox.supports(p)
          ? mailbox.waitForLink(p, signal)
          : configuredInbox.waitForLink(p, signal),
    }),
    agentBrowser || openNativeSession,
    sessions,
    new FileAuthChallenges(dataDirectory),
    agentBrowser ? new AutomaticRegistrationProfile(mailbox) : undefined,
  );
  const collector = createUrlCollector(store, extraction);
  const processor = new CaseProcessingService(
    store,
    [
      new CollectionStage(
        store,
        (c, signal) => (c.analysisLevel === 'pro' ? proCollector : collector).collect(c, signal),
        (c, e) => extraction.extract(c, e),
      ),
      new AuthenticationStage(store, authentication),
      new ResourceProfileStage(
        store,
        (c) => collectContactPages(store, c, extraction),
        createOsintFacade(),
      ),
      new LegalCorpusStage(
        store,
        new LegalCorpusService([new AdiletApiReader(), new AdiletHtmlReader()]),
      ),
      new ProEnrichmentStage(
        store,
        new OfficialSourcesService(),
        new DetectiveService(),
        new ResourceInvestigator([new CertificateTransparencyProvider()]),
      ),
      new InspectionStage(store, createInspectionFacade(ai)),
      new FindingVerificationStage(
        store,
        new EvidenceSupervisor([
          {
            id: 'primary-proof',
            verify: (record, signal) =>
              new BrowserFindingVerifier(
                store,
                async (record, signal, viewport) => {
                  const active = sessions.get(record.id);
                  if (active) {
                    const abort = () => {
                      void active.close();
                    };
                    signal.addEventListener('abort', abort, { once: true });
                    return {
                      context: active.context,
                      close: async () => signal.removeEventListener('abort', abort),
                    };
                  }
                  if (
                    record.collection?.attempts.some(
                      (a) => a.method === 'browser-patchright' && a.status === 'adequate',
                    )
                  )
                    return openPatchrightSession(signal, viewport);
                  const native = record.collection?.attempts.some(
                    (a) => a.method.startsWith('browser-native') && a.status === 'adequate',
                  );
                  return (native ? openNativeSession : openInterceptedSession)(signal, viewport);
                },
                async (record, page) => {
                  const text = await page.locator('body').innerText();
                  const active = sessions.get(record.id);
                  return (
                    !!active &&
                    new URL(page.url()).origin === active.profile.origin &&
                    (await page.locator(active.profile.successSelector).isVisible()) &&
                    !(active.secrets || []).some((secret) => text.includes(secret))
                  );
                },
              ).verify(record, signal),
          },
          {
            id: 'alternate-proof',
            verify: (record, signal) =>
              new BrowserFindingVerifier(store, async (c, s, viewport) => {
                if (c.authenticationRequest) throw Error('AUTH_SESSION_REQUIRED');
                const usedNative = c.collection?.attempts.some(
                  (a) => a.method.startsWith('browser-native') && a.status === 'adequate',
                );
                return (usedNative ? openInterceptedSession : openNativeSession)(s, viewport);
              }).verify(record, signal),
          },
        ]),
      ),
    ],
    progress,
    async (id) => {
      await sessions.release(id);
      await mailbox.release('automatic-' + id);
    },
    {
      budgetMs: 400000,
      scope: store,
      stageBudgets: {
        'collection-v2': 130000,
        'authentication-v1': 60000,
        'resource-profile-v1': 15000,
        'legal-corpus-v1': 30000,
        'pro-enrichment-v1': 20000,
        'inspection-v1': 90000,
        'finding-verification-v1': 50000,
      },
    },
  );
  return processor;
}
