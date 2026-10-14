import type { CaseRecord, Evidence } from '../../../shared/types.ts';
import type {
  AuditWriter,
  CaseRepository,
  CaseStore,
  EvidenceInput,
  EvidenceStorage,
} from '../ports/storage.ts';

/** Facade for callers that coordinate a complete case; each dependency owns one responsibility. */
export class Store implements CaseStore {
  constructor(
    private repository: CaseRepository,
    private audit: AuditWriter,
    private evidence: Pick<EvidenceStorage, 'addEvidence' | 'read'>,
    private integrity: Pick<EvidenceStorage, 'verify'>,
  ) {}
  all() {
    return this.repository.all();
  }
  list() {
    return this.repository.list();
  }
  get(id: string) {
    return this.repository.get(id);
  }
  save(record: CaseRecord) {
    this.repository.save(record);
  }
  event(record: CaseRecord, action: string, detail = '') {
    this.audit.event(record, action, detail);
  }
  addEvidence(record: CaseRecord, bytes: Buffer, input: EvidenceInput) {
    return this.evidence.addEvidence(record, bytes, input);
  }
  read(record: CaseRecord, evidence: Evidence) {
    return this.evidence.read(record, evidence);
  }
  verify(record: CaseRecord) {
    this.integrity.verify(record);
  }
}
