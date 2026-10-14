import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createLocalStorage } from '../server/bootstrap/create-local-storage.ts';
import { createPostgresStorage } from '../server/bootstrap/create-postgres-storage.ts';
import { newCase } from '../server/application/create-case.ts';
import { defaultTemplate } from '../server/templates/default-template.ts';
import { importSqlite } from '../server/storage/postgres/import-sqlite.ts';
import { migratePostgresSchema } from '../server/storage/postgres/schema.ts';
import { PostgresCaseRepository } from '../server/storage/postgres/PostgresCaseRepository.ts';
import { sha256 } from '../server/domain/sha256.ts';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL_REQUIRED');
// Always create a dedicated schema: integration tests must not truncate a user's tables.
const schema = `test_${Date.now()}_${process.pid}`;
const admin = new Pool({ connectionString: url, max: 1 });
const schemaUrl = new URL(url);
schemaUrl.searchParams.set('options', `-c search_path=${schema}`);

test('PostgreSQL: migration, unchanged hashes, restart, sequence, conflicts and exclusive runtime', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aigak-pg-test-'));
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ connectionString: schemaUrl.href, max: 3 });
  let closeRuntime: (() => Promise<void>) | undefined;
  try {
    const local = createLocalStorage(directory);
    const record = await newCase(local.store, {
      title: 'Synthetic migration',
      sourceType: 'text',
      useAi: false,
    });
    const evidence = await local.store.addEvidence(record, Buffer.from('original bytes'), {
      name: 'source.txt',
      mime: 'text/plain',
      kind: 'original',
      method: 'test',
    });
    const template = await local.templates.add('Synthetic template', await defaultTemplate());
    record.status = 'review';
    await local.store.save(record);
    const expected = await local.store.get(record.id);
    local.close();
    const source = path.join(directory, 'aigak.sqlite');
    const sourceHash = sha256(readFileSync(source));
    const evidencePath = path.join(directory, 'evidence', record.id, evidence.storedName);
    chmodSync(evidencePath, 0o600);
    writeFileSync(evidencePath, 'tampered');
    await assert.rejects(importSqlite(pool, source), /INTEGRITY_FAILED/);
    writeFileSync(evidencePath, 'original bytes');
    chmodSync(evidencePath, 0o400);
    assert.deepEqual(await importSqlite(pool, source), {
      cases: 1,
      templates: 1,
      alreadyImported: false,
    });
    assert.deepEqual(await importSqlite(pool, source), {
      cases: 1,
      templates: 1,
      alreadyImported: true,
    });
    assert.equal(sha256(readFileSync(source)), sourceHash);
    await migratePostgresSchema(pool);
    let storage = await createPostgresStorage(directory, schemaUrl.href);
    closeRuntime = storage.close;
    const loaded = await storage.store.get(record.id);
    assert.deepEqual(loaded, expected);
    storage.store.verify(loaded!);
    assert.equal(storage.store.read(loaded!, evidence).toString(), 'original bytes');
    assert.deepEqual(
      await storage.templates.raw(template.id),
      readFileSync(path.join(directory, 'templates', `${template.id}.docx`)),
    );
    await assert.rejects(createPostgresStorage(directory, schemaUrl.href), /DATABASE_IN_USE/);
    await assert.rejects(importSqlite(pool, source), /DATABASE_IN_USE/);
    const first = await storage.store.get(record.id);
    const stale = await storage.store.get(record.id);
    first!.title = 'First writer';
    await storage.store.save(first!);
    stale!.title = 'Stale writer';
    await assert.rejects(storage.store.save(stale!), /CASE_CONFLICT/);
    assert.equal((await storage.store.get(record.id))!.title, 'First writer');
    const numbers = await Promise.all(
      Array.from({ length: 12 }, () => storage.store.nextNumber(2026)),
    );
    assert.equal(new Set(numbers).size, 12);
    assert.ok(numbers.every((number) => number !== record.number));
    await storage.close();
    closeRuntime = undefined;
    await assert.rejects(importSqlite(pool, source), /MIGRATION_TARGET_NOT_EMPTY/);
    storage = await createPostgresStorage(directory, schemaUrl.href);
    closeRuntime = storage.close;
    assert.equal((await storage.store.get(record.id))!.title, 'First writer');
    storage.store.verify((await storage.store.get(record.id))!);
    const repository = new PostgresCaseRepository(pool);
    assert.equal(await repository.get('missing'), undefined);
    assert.equal((await repository.list())[0].evidenceCount, 1);
  } finally {
    await closeRuntime?.();
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    rmSync(directory, { recursive: true, force: true });
  }
});
