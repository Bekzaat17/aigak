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
  nextNumber(year: number) {
    return this.repository.nextNumber(year);
  }
  async all() {
    return await this.repository.all();
  }
  async list() {
    return await this.repository.list();
  }
  async get(id: string) {
    return await this.repository.get(id);
  }
  async save(record: CaseRecord) {
    await this.repository.save(record);
  }
  async event(record: CaseRecord, action: string, detail = '') {
    await this.audit.event(record, action, detail);
  }
  async addEvidence(record: CaseRecord, bytes: Buffer, input: EvidenceInput) {
    return await this.evidence.addEvidence(record, bytes, input);
  }
  read(record: CaseRecord, evidence: Evidence) {
    return this.evidence.read(record, evidence);
  }
  verify(record: CaseRecord) {
    this.integrity.verify(record);
  }
}
