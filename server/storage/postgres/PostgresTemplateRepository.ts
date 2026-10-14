import type { Pool } from 'pg';
import type { TemplateEntry, TemplateRepository } from '../../application/ports/templates.ts';
export class PostgresTemplateRepository implements TemplateRepository {
  constructor(private readonly db: Pick<Pool, 'query'>) {}
  async list(): Promise<TemplateEntry[]> {
    return (
      await this.db.query<TemplateEntry>('SELECT id,name,sha256 FROM templates ORDER BY ordinal')
    ).rows;
  }
  async get(id: string): Promise<TemplateEntry | undefined> {
    return (
      await this.db.query<TemplateEntry>('SELECT id,name,sha256 FROM templates WHERE id=$1', [id])
    ).rows[0];
  }
  async findByHash(hash: string): Promise<TemplateEntry | undefined> {
    return (
      await this.db.query<TemplateEntry>(
        'SELECT id,name,sha256 FROM templates WHERE sha256=$1 ORDER BY ordinal LIMIT 1',
        [hash],
      )
    ).rows[0];
  }
  async save(entry: TemplateEntry): Promise<void> {
    await this.db.query('INSERT INTO templates(id,name,sha256) VALUES($1,$2,$3)', [
      entry.id,
      entry.name,
      entry.sha256,
    ]);
  }
}
