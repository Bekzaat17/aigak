import type { CaseRecord } from '../../../shared/types.ts';
import { sha256 } from '../../domain/sha256.ts';
import type { EvidenceStorage } from '../ports/storage.ts';

export class CaseIntegrityVerifier implements Pick<EvidenceStorage, 'verify'> {
  constructor(private evidence: Pick<EvidenceStorage, 'read'>) {}
  verify(c: CaseRecord) {
    for (const revision of c.revisions || []) {
      const { sha256: expected, ...snapshot } = revision;
      if (expected && sha256(JSON.stringify(snapshot)) !== expected)
        throw new Error('INTEGRITY_FAILED');
    }
    for (const e of c.evidence) {
      if (sha256(this.evidence.read(c, e)) !== e.sha256) throw new Error('INTEGRITY_FAILED');
    }
    let prev = '0'.repeat(64);
    for (const { hash, ...e } of c.audit) {
      if (e.previousHash !== prev || sha256(JSON.stringify(e)) !== hash)
        throw new Error('INTEGRITY_FAILED');
      prev = hash;
    }
  }
}
