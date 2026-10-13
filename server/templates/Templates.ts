import Docxtemplater from 'docxtemplater';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import type { Lang } from '../../shared/types.ts';
import { Store, sha256 } from '../storage/Store.ts';
import { defaultTemplate } from './default-template.ts';
import { fields } from './fields.ts';

export class Templates {
  constructor(private store: Store) {
    store.db.exec(
      'CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, sha256 TEXT NOT NULL)',
    );
    mkdirSync(path.join(store.dir, 'templates'), { recursive: true, mode: 0o700 });
  }
  list() {
    return [
      { id: 'builtin', name: 'aigak · RU / KK', sha256: '' },
      ...this.store.db.prepare('SELECT id,name,sha256 FROM templates').all(),
    ];
  }
  has(id: string) {
    return (
      id === 'builtin' || !!this.store.db.prepare('SELECT id FROM templates WHERE id=?').get(id)
    );
  }
  validate(data: Buffer) {
    if (data.length > 2 * 1024 * 1024) throw new Error('TEMPLATE_TOO_LARGE');
    try {
      const zip = new PizZip(data);
      const entries = Object.values(zip.files);
      let bytes = 0;
      if (entries.length > 200 || !zip.file('word/document.xml'))
        throw new Error('INVALID_TEMPLATE');
      for (const entry of entries) {
        if (entry.dir) continue;
        const size =
          (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ||
          0;
        bytes += size;
        if (bytes > 15 * 1024 * 1024) throw new Error('TEMPLATE_TOO_LARGE');
        if (/vbaProject|embeddings\//i.test(entry.name)) throw new Error('INVALID_TEMPLATE');
        if (entry.name.endsWith('.rels') && /TargetMode\s*=\s*["']External/i.test(entry.asText()))
          throw new Error('TEMPLATE_EXTERNAL_LINK');
      }
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const text = doc.getFullText();
      if (!['case_number', 'findings', 'evidence_list'].every((f) => text.includes(`{${f}}`)))
        throw new Error('TEMPLATE_FIELDS_MISSING');
      const tags = [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
      if (tags.some((t) => !fields.includes(t))) throw new Error('TEMPLATE_UNKNOWN_FIELD');
    } catch (e) {
      if (e instanceof Error && /^TEMPLATE_|^INVALID_TEMPLATE$/.test(e.message)) throw e;
      throw new Error('INVALID_TEMPLATE', { cause: e });
    }
  }
  add(name: string, data: Buffer) {
    this.validate(data);
    const id = randomUUID();
    const hash = sha256(data);
    const existing = this.store.db
      .prepare('SELECT id,name,sha256 FROM templates WHERE sha256=?')
      .get(hash);
    if (existing) return existing;
    writeFileSync(path.join(this.store.dir, 'templates', `${id}.docx`), data, {
      flag: 'wx',
      mode: 0o400,
    });
    this.store.db
      .prepare('INSERT INTO templates(id,name,sha256) VALUES(?,?,?)')
      .run(id, name.slice(0, 120), hash);
    return { id, name, sha256: hash };
  }
  async raw(id: string, lang: Lang = 'ru') {
    if (id === 'builtin') return defaultTemplate(lang);
    const row = this.store.db.prepare('SELECT sha256 FROM templates WHERE id=?').get(id) as
      { sha256: string } | undefined;
    if (!row) throw new Error('NOT_FOUND');
    const data = readFileSync(path.join(this.store.dir, 'templates', `${id}.docx`));
    if (sha256(data) !== row.sha256) throw new Error('INTEGRITY_FAILED');
    return data;
  }
}
