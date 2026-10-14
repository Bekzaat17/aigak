import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { CaseRecord, Evidence } from '../../../shared/types.ts';
import { sha256 } from '../../domain/sha256.ts';
import type { BlobStorage } from '../ports/blobs.ts';
import type { AuditWriter, EvidenceInput, EvidenceStorage } from '../ports/storage.ts';

export class EvidenceService implements Pick<EvidenceStorage, 'addEvidence' | 'read'> {
  constructor(
    private blobs: BlobStorage,
    private audit: AuditWriter,
  ) {}
  async addEvidence(c: CaseRecord, data: Buffer, input: EvidenceInput) {
    const id = randomUUID();
    const storedName = `${id}${path
      .extname(input.name)
      .replace(/[^a-zA-Z0-9.]/g, '')
      .slice(0, 10)}`;
    this.blobs.write(c.id, storedName, data);
    const evidence: Evidence = {
      ...input,
      id,
      storedName,
      size: data.length,
      sha256: sha256(data),
      createdAt: new Date().toISOString(),
    };
    c.evidence.push(evidence);
    await this.audit.event(c, 'evidence.saved', `${id} SHA-256 ${evidence.sha256}`);
    return evidence;
  }
  read(c: CaseRecord, e: Evidence) {
    return this.blobs.read(c.id, e.storedName);
  }
}
