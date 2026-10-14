import { randomUUID } from 'node:crypto';
import type { CaseRecord } from '../../../shared/types.ts';
import { sha256 } from '../../domain/sha256.ts';
import type { AuditWriter, CaseRepository } from '../ports/storage.ts';

export class AuditLog implements AuditWriter {
  constructor(private repository: Pick<CaseRepository, 'save'>) {}
  event(c: CaseRecord, action: string, detail = '') {
    const e = {
      id: randomUUID(),
      at: new Date().toISOString(),
      action,
      detail,
      previousHash: c.audit.at(-1)?.hash || '0'.repeat(64),
    };
    c.audit.push({ ...e, hash: sha256(JSON.stringify(e)) });
    this.repository.save(c);
  }
}
