import { CaseProcessingService } from '../application/processing/CaseProcessingService.ts';
import { CollectionStage } from '../application/processing/CollectionStage.ts';
import { InspectionStage } from '../application/processing/InspectionStage.ts';
import { ProEnrichmentStage } from '../application/processing/ProEnrichmentStage.ts';
import { ResourceProfileStage } from '../application/processing/ResourceProfileStage.ts';
import { Queue } from '../application/Queue.ts';
import { collectUrl } from '../collector.ts';
import type { AiAnalyzer } from '../inspection/contracts.ts';
import { createInspectionFacade } from '../inspection/index.ts';
import { DetectiveService } from '../osint/DetectiveService.ts';
import { CertificateTransparencyProvider } from '../osint/discovery/CertificateTransparencyProvider.ts';
import { ResourceInvestigator } from '../osint/discovery/ResourceInvestigator.ts';
import { createOsintFacade } from '../osint/index.ts';
import { LegalCorpusService } from '../osint/LegalCorpusService.ts';
import { OfficialSourcesService } from '../osint/OfficialSourcesService.ts';
import { collectContactPages } from '../osint/site-pages.ts';
import type { Store } from '../storage/Store.ts';
import { createExtraction } from './create-extraction.ts';

export function createProcessing(store: Store, ai?: AiAnalyzer) {
  const extraction = createExtraction(store, store.dir);
  const processor = new CaseProcessingService(store, [
    new CollectionStage(
      store,
      (c) => collectUrl(store, c),
      (c, e) => extraction.extract(c, e),
    ),
    new ResourceProfileStage(store, (c) => collectContactPages(store, c), createOsintFacade()),
    new ProEnrichmentStage(
      store,
      new OfficialSourcesService(),
      new LegalCorpusService(),
      new DetectiveService(),
      new ResourceInvestigator([new CertificateTransparencyProvider()]),
    ),
    new InspectionStage(store, createInspectionFacade(ai)),
  ]);
  processor.recoverInterrupted();
  return { processor, queue: new Queue(processor) };
}
