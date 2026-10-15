import type { BrowserSessionFactory } from './browser/contracts';
import type { CaseRecord } from '../../shared/types.ts';
import type { CollectionStorage, EvidenceExtractor, UrlCollectionMethod } from './contracts.ts';
import { captureBrowserSource } from './capture-browser-source.ts';

export class BrowserCollectionMethod implements UrlCollectionMethod {
  constructor(
    readonly id: string,
    private readonly store: Pick<CollectionStorage, 'addEvidence'>,
    private readonly extraction: EvidenceExtractor,
    private readonly viewport: { width: number; height: number },
    readonly fallback = false,
    private readonly openSession?: BrowserSessionFactory,
  ) {}
  collect(record: CaseRecord, signal: AbortSignal) {
    return captureBrowserSource(
      this.store,
      record,
      this.extraction,
      this.viewport,
      this.id,
      signal,
      this.openSession,
    );
  }
}
