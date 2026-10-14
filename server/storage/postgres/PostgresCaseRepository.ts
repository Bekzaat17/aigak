import type { Pool } from 'pg';
import type { CaseRecord, CaseSummary } from '../../../shared/types.ts';
import type { CaseRepository } from '../../application/ports/storage.ts';
import { hydrateCase } from '../../domain/hydrate-case.ts';

export class PostgresCaseRepository implements CaseRepository {
  private readonly originals = new WeakMap<CaseRecord, string>();
  constructor(private readonly db: Pick<Pool, 'query'>) {}
  private hydrate(body: string): CaseRecord {
    const record = hydrateCase(body);
    this.originals.set(record, body);
    return record;
  }
  async all(): Promise<CaseRecord[]> {
    const result = await this.db.query<{ body: string }>(
      'SELECT body FROM cases ORDER BY ordinal DESC',
    );
    return result.rows.map((row) => this.hydrate(row.body));
  }
  async list(): Promise<CaseSummary[]> {
    return (await this.all()).map(({ evidence, findings, audit: _audit, ...record }) => ({
      ...record,
      evidenceCount: evidence.length,
      findingCount: findings.length,
      acceptedCount: findings.filter((finding) => finding.decision === 'accepted').length,
    }));
  }
  async get(id: string): Promise<CaseRecord | undefined> {
    const result = await this.db.query<{ body: string }>('SELECT body FROM cases WHERE id=$1', [
      id,
    ]);
    return result.rows[0] && this.hydrate(result.rows[0].body);
  }
  async nextNumber(year: number): Promise<string> {
    const result = await this.db.query<{ number: string }>(
      "SELECT nextval('case_number_seq')::text AS number",
    );
    return `AG-${year}-${result.rows[0].number.padStart(4, '0')}`;
  }
  async save(record: CaseRecord): Promise<void> {
    const previous = this.originals.get(record);
    record.updatedAt = new Date().toISOString();
    const body = JSON.stringify(record);
    const result =
      previous === undefined
        ? await this.db.query(
            'INSERT INTO cases(id,body) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
            [record.id, body],
          )
        : await this.db.query('UPDATE cases SET body=$2 WHERE id=$1 AND body=$3', [
            record.id,
            body,
            previous,
          ]);
    if (result.rowCount !== 1) throw new Error('CASE_CONFLICT');
    this.originals.set(record, body);
  }
}
