import type { DatabaseSync } from 'node:sqlite';
import type { CaseRecord, CaseSummary } from '../../shared/types.ts';
import type { CaseRepository } from '../application/ports/storage.ts';
import { hydrateCase } from '../domain/hydrate-case.ts';

export class SqliteCaseRepository implements CaseRepository {
  constructor(private db: DatabaseSync) {
    db.exec('CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
  }
  async nextNumber(year: number): Promise<string> {
    return `AG-${year}-${String((await this.all()).length + 1).padStart(4, '0')}`;
  }
  async all(): Promise<CaseRecord[]> {
    return (
      this.db.prepare('SELECT body FROM cases ORDER BY rowid DESC').all() as { body: string }[]
    ).map((x) => hydrateCase(x.body));
  }
  async list(): Promise<CaseSummary[]> {
    return (await this.all()).map(({ evidence, findings, audit: _audit, ...c }) => ({
      ...c,
      evidenceCount: evidence.length,
      findingCount: findings.length,
      acceptedCount: findings.filter((f) => f.decision === 'accepted').length,
    }));
  }
  async get(id: string): Promise<CaseRecord | undefined> {
    const row = this.db.prepare('SELECT body FROM cases WHERE id=?').get(id) as
      { body: string } | undefined;
    return row && hydrateCase(row.body);
  }
  async save(c: CaseRecord) {
    c.updatedAt = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO cases(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
      )
      .run(c.id, JSON.stringify(c));
  }
}
