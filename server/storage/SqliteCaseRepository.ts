import type { DatabaseSync } from 'node:sqlite';
import type { CaseRecord, CaseSummary } from '../../shared/types.ts';
import type { CaseRepository } from '../application/ports/storage.ts';
import { hydrateCase } from '../domain/hydrate-case.ts';

export class SqliteCaseRepository implements CaseRepository {
  constructor(private db: DatabaseSync) {
    db.exec('CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
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
}
