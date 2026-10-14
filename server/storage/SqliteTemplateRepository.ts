import type { DatabaseSync } from 'node:sqlite';
import type { TemplateEntry, TemplateRepository } from '../application/ports/templates.ts';

export class SqliteTemplateRepository implements TemplateRepository {
  constructor(private db: DatabaseSync) {
    db.exec(
      'CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, sha256 TEXT NOT NULL)',
    );
  }
  async list(): Promise<TemplateEntry[]> {
    return this.db
      .prepare('SELECT id,name,sha256 FROM templates')
      .all() as unknown as TemplateEntry[];
  }
  async get(id: string): Promise<TemplateEntry | undefined> {
    return this.db.prepare('SELECT id,name,sha256 FROM templates WHERE id=?').get(id) as
      TemplateEntry | undefined;
  }
  async findByHash(hash: string): Promise<TemplateEntry | undefined> {
    return this.db.prepare('SELECT id,name,sha256 FROM templates WHERE sha256=?').get(hash) as
      TemplateEntry | undefined;
  }
  async save(entry: TemplateEntry): Promise<void> {
    this.db
      .prepare('INSERT INTO templates(id,name,sha256) VALUES(?,?,?)')
      .run(entry.id, entry.name, entry.sha256);
  }
}
