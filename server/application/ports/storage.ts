import type { CaseRecord, CaseSummary, Evidence } from '../../../shared/types.ts';

export interface CaseRepository {
  nextNumber(year: number): Promise<string>;
  all(): Promise<CaseRecord[]>;
  list(): Promise<CaseSummary[]>;
  get(id: string): Promise<CaseRecord | undefined>;
  save(record: CaseRecord): Promise<void>;
}

export type EvidenceInput = Pick<Evidence, 'name' | 'mime' | 'kind' | 'method'> &
  Partial<Pick<Evidence, 'parentId' | 'text' | 'sourceUrl'>>;

export interface EvidenceStorage {
  addEvidence(record: CaseRecord, bytes: Buffer, input: EvidenceInput): Promise<Evidence>;
  read(record: CaseRecord, evidence: Evidence): Buffer;
  verify(record: CaseRecord): void;
}

export interface AuditWriter {
  event(record: CaseRecord, action: string, detail?: string): Promise<void>;
}

/** Application-facing storage contract; implementations may use files, SQL or a remote service. */
export interface CaseStore extends CaseRepository, EvidenceStorage, AuditWriter {}
