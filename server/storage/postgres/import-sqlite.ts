import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Pool } from 'pg';
import type { CaseRecord } from '../../../shared/types.ts';
import type { TemplateEntry } from '../../application/ports/templates.ts';
import { CaseIntegrityVerifier } from '../../application/storage/CaseIntegrityVerifier.ts';
import { sha256 } from '../../domain/sha256.ts';
import { migratePostgresSchema } from './schema.ts';

/** Read-only source, transactional target. Files remain in the same DATA_DIR. */
export async function importSqlite(pool: Pool, sourceFile: string) {
  const source = new DatabaseSync(sourceFile, { readOnly: true });
  let cases: { id: string; body: string }[];
  let templates: TemplateEntry[];
  try {
    source.exec('BEGIN');
    cases = source.prepare('SELECT id,body FROM cases ORDER BY rowid').all() as {
      id: string;
      body: string;
    }[];
    const hasTemplates = source
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='templates'")
      .get();
    templates = hasTemplates
      ? (source
          .prepare('SELECT id,name,sha256 FROM templates ORDER BY rowid')
          .all() as unknown as TemplateEntry[])
      : [];
    source.exec('COMMIT');
  } finally {
    source.close();
  }
  const directory = path.dirname(path.resolve(sourceFile));
  const read = (folder: string, ...segments: string[]) => {
    const base = path.join(directory, folder);
    const filename = path.resolve(base, ...segments);
    if (!filename.startsWith(base + path.sep)) throw new Error('INVALID_STORAGE_PATH');
    return readFileSync(filename);
  };
  const integrity = new CaseIntegrityVerifier({
    read: (record, evidence) => read('evidence', record.id, evidence.storedName),
  });
  let largestNumber = 0;
  for (const row of cases) {
    const record = JSON.parse(row.body) as CaseRecord;
    if (record.id !== row.id) throw new Error('INVALID_CASE_ID');
    integrity.verify(record);
    const number = /^AG-\d{4}-(\d+)$/.exec(record.number);
    if (number) largestNumber = Math.max(largestNumber, Number(number[1]));
  }
  for (const entry of templates)
    if (sha256(read('templates', `${entry.id}.docx`)) !== entry.sha256)
      throw new Error('INTEGRITY_FAILED');
  await migratePostgresSchema(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lease = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(834172, 2) AS acquired',
    );
    if (!lease.rows[0].acquired) throw new Error('DATABASE_IN_USE');
    await client.query('LOCK TABLE cases, templates IN EXCLUSIVE MODE');
    const existingCases = (
      await client.query<{ id: string; body: string }>('SELECT id,body FROM cases')
    ).rows;
    const existingTemplates = (
      await client.query<TemplateEntry>('SELECT id,name,sha256 FROM templates')
    ).rows;
    if (existingCases.length || existingTemplates.length) {
      const sameCases =
        existingCases.length === cases.length &&
        existingCases.every((row) =>
          cases.some((original) => original.id === row.id && original.body === row.body),
        );
      const sameTemplates =
        existingTemplates.length === templates.length &&
        existingTemplates.every((row) =>
          templates.some(
            (original) =>
              original.id === row.id &&
              original.name === row.name &&
              original.sha256 === row.sha256,
          ),
        );
      if (!sameCases || !sameTemplates) throw new Error('MIGRATION_TARGET_NOT_EMPTY');
      await client.query('COMMIT');
      return { cases: cases.length, templates: templates.length, alreadyImported: true };
    }
    for (const row of cases)
      await client.query('INSERT INTO cases(id,body) VALUES($1,$2)', [row.id, row.body]);
    for (const row of templates)
      await client.query('INSERT INTO templates(id,name,sha256) VALUES($1,$2,$3)', [
        row.id,
        row.name,
        row.sha256,
      ]);
    // ALTER SEQUENCE is transactional; a rolled-back import must not consume the migrated range.
    const next = Math.max(cases.length, largestNumber) + 1;
    if (!Number.isSafeInteger(next)) throw new Error('INVALID_CASE_NUMBER');
    await client.query(`ALTER SEQUENCE case_number_seq RESTART WITH ${next}`);
    await client.query('COMMIT');
    return { cases: cases.length, templates: templates.length, alreadyImported: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
