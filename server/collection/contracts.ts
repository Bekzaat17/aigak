import type { CaseRecord, Evidence } from '../../shared/types.ts';
import type { CaseRepository, EvidenceStorage } from '../application/ports/storage.ts';

export type CollectionStorage = Pick<EvidenceStorage, 'addEvidence' | 'read'> &
  Pick<CaseRepository, 'save'>;

export interface ExtractionContext {
  store: CollectionStorage;
  record: CaseRecord;
  evidence: Evidence;
  data: Buffer;
}

export interface FileExtractor {
  supports(mime: string): boolean;
  extract(context: ExtractionContext): Promise<void>;
}

export interface OcrEngine {
  readonly available: boolean;
  recognize(data: Buffer): Promise<string>;
}

export interface EvidenceExtractor {
  extract(record: CaseRecord, evidence: Evidence): Promise<void>;
}

export interface UrlCollectionMethod {
  readonly id: string;
  readonly fallback?: boolean;
  collect(record: CaseRecord, signal: AbortSignal): Promise<void>;
}
