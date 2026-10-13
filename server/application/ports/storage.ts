import type { CaseRecord, CaseSummary, Evidence } from '../../../shared/types.ts';

export interface CaseRepository {
  all(): CaseRecord[];
  list(): CaseSummary[];
  get(id: string): CaseRecord | undefined;
  save(record: CaseRecord): void;
}

export type EvidenceInput = Pick<Evidence, 'name' | 'mime' | 'kind' | 'method'> &
  Partial<Pick<Evidence, 'parentId' | 'text' | 'sourceUrl'>>;

export interface EvidenceStorage {
  addEvidence(record: CaseRecord, bytes: Buffer, input: EvidenceInput): Evidence;
  read(record: CaseRecord, evidence: Evidence): Buffer;
  verify(record: CaseRecord): void;
}

export interface AuditWriter {
  event(record: CaseRecord, action: string, detail?: string): void;
}

/** Application-facing storage contract; implementations may use files, SQL or a remote service. */
export interface CaseStore extends CaseRepository, EvidenceStorage, AuditWriter {}
