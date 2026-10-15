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
  store: CaseStore,
  dataDirectory: string,
  ai?: AiAnalyzer,
  progress?: ProcessingProgress,
) {
  const extraction = createExtraction(store, dataDirectory);
  const sessions = new CaseBrowserSessions();
  const profiles = parseAuthProfiles(process.env.AIGAK_AUTH_PROFILES);
  const collector = createUrlCollector(store, extraction, [
    new AuthenticatedCollectionMethod(
      store,
      profiles,
      new BrowserAuthenticationAgent(new VerificationInboxClient()),
      openNativeSession,
      sessions,
    ),
  ]);
  const processor = new CaseProcessingService(
    store,
    [
      new CollectionStage(
        store,
        (c) => collector.collect(c),
        (c, e) => extraction.extract(c, e),
      ),
      new ResourceProfileStage(
        store,
        (c) => collectContactPages(store, c, extraction),
        createOsintFacade(),
      ),
      new ProEnrichmentStage(
        store,
        new OfficialSourcesService(),
        new LegalCorpusService(),
        new DetectiveService(),
        new ResourceInvestigator([new CertificateTransparencyProvider()]),
      ),
      new InspectionStage(store, createInspectionFacade(ai)),
      new FindingVerificationStage(
        store,
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
            const native = record.collection?.attempts.some(
              (a) => a.method.startsWith('browser-native') && a.status === 'adequate',
            );
            return (native ? openNativeSession : openInterceptedSession)(signal, viewport);
          },
          async (record, page) => {
            const active = sessions.get(record.id);
            return (
              !!active &&
              new URL(page.url()).origin === active.profile.origin &&
              (await page.locator(active.profile.successSelector).isVisible())
            );
          },
        ),
      ),
    ],
    progress,
    (id) => sessions.release(id),
  );
  return processor;
}
