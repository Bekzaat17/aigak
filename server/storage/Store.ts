import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CaseRecord, CaseSummary, Evidence } from '../../shared/types.ts';
import { sha256 } from '../domain/sha256.ts';

export { sha256 } from '../domain/sha256.ts';
export function hydrateCase(body: string): CaseRecord {
  const c = JSON.parse(body) as CaseRecord;
  c.analysisLevel ??= c.useAi ? 'advanced' : 'basic';
  return c;
}
export class Store {
  db: DatabaseSync;
  constructor(public dir: string) {
    mkdirSync(path.join(dir, 'evidence'), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dir, 'aigak.sqlite'));
    this.db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, body TEXT NOT NULL);',
    );
  }
  all(): CaseRecord[] {
    return (
      this.db.prepare('SELECT body FROM cases ORDER BY rowid DESC').all() as { body: string }[]
    ).map((x) => hydrateCase(x.body));
  }
  list(): CaseSummary[] {
    return this.all().map(({ evidence, findings, audit: _audit, ...c }) => ({
      ...c,
      evidenceCount: evidence.length,
      findingCount: findings.length,
      acceptedCount: findings.filter((f) => f.decision === 'accepted').length,
    }));
  }
  get(id: string): CaseRecord | undefined {
    const row = this.db.prepare('SELECT body FROM cases WHERE id=?').get(id) as
      { body: string } | undefined;
    return row && hydrateCase(row.body);
  }
  save(c: CaseRecord) {
    c.updatedAt = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO cases(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
      )
      .run(c.id, JSON.stringify(c));
  }
  event(c: CaseRecord, action: string, detail = '') {
    const e = {
      id: randomUUID(),
      at: new Date().toISOString(),
      action,
      detail,
      previousHash: c.audit.at(-1)?.hash || '0'.repeat(64),
    };
    c.audit.push({ ...e, hash: sha256(JSON.stringify(e)) });
    this.save(c);
  }
  addEvidence(
    c: CaseRecord,
    data: Buffer,
    input: Pick<Evidence, 'name' | 'mime' | 'kind' | 'method'> &
      Partial<Pick<Evidence, 'parentId' | 'text' | 'sourceUrl'>>,
  ) {
    const id = randomUUID();
    const storedName = `${id}${path
      .extname(input.name)
      .replace(/[^a-zA-Z0-9.]/g, '')
      .slice(0, 10)}`;
    const folder = path.join(this.dir, 'evidence', c.id);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    writeFileSync(path.join(folder, storedName), data, { flag: 'wx', mode: 0o400 });
    const evidence: Evidence = {
      ...input,
      id,
      storedName,
      size: data.length,
      sha256: sha256(data),
      createdAt: new Date().toISOString(),
    };
    c.evidence.push(evidence);
    this.event(c, 'evidence.saved', `${id} SHA-256 ${evidence.sha256}`);
    return evidence;
  }
  read(c: CaseRecord, e: Evidence) {
    return readFileSync(path.join(this.dir, 'evidence', c.id, e.storedName));
  }
  verify(c: CaseRecord) {
    for (const revision of c.revisions || []) {
      const { sha256: expected, ...snapshot } = revision;
      if (expected && sha256(JSON.stringify(snapshot)) !== expected)
        throw new Error('INTEGRITY_FAILED');
    }
    for (const e of c.evidence) {
      if (sha256(this.read(c, e)) !== e.sha256) throw new Error('INTEGRITY_FAILED');
    }
    let prev = '0'.repeat(64);
    for (const { hash, ...e } of c.audit) {
      if (e.previousHash !== prev || sha256(JSON.stringify(e)) !== hash)
        throw new Error('INTEGRITY_FAILED');
      prev = hash;
    }
  }
  close() {
    this.db.close();
  }
}
