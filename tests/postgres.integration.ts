import { startRevision } from '../server/revisions.ts';
import { InterruptedIntakeRecovery } from '../server/application/processing/InterruptedIntakeRecovery.ts';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
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
import { ProcessingWorker } from '../server/application/processing/ProcessingWorker.ts';
import { CaseProcessingService } from '../server/application/processing/CaseProcessingService.ts';
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
    // API and worker coexist, but a second worker cannot execute the same queue.
    const workerStorage = await createPostgresStorage(directory, schemaUrl.href, 'worker');
    try {
      await assert.rejects(
        createPostgresStorage(directory, schemaUrl.href, 'worker'),
        /DATABASE_IN_USE/,
      );
      const queued = await newCase(storage.store, {
        title: 'Durable task',
        sourceType: 'text',
        useAi: false,
      });
      await storage.jobs.add(queued.id);
      await storage.jobs.add(queued.id);
      assert.equal(await storage.jobs.countPending(), 1);
      assert.equal((await workerStorage.jobs.claim())?.attempt, 1);
      assert.equal(await storage.jobs.countPending(), 0);
      await workerStorage.jobs.checkpoint(queued.id, 'first');
      // The next runtime recovers a running task and skips persisted completed stages.
      let executed = 0;
      const processor = new CaseProcessingService(
        workerStorage.store,
        [
          {
            id: 'first',
            execute: async () => {
              throw new Error('completed stage must not repeat');
            },
          },
          {
            id: 'second',
            execute: async () => {
              executed++;
            },
          },
        ],
        workerStorage.jobs,
      );
      const worker = new ProcessingWorker(workerStorage.jobs, processor, processor);
      await worker.tick();
      assert.equal(executed, 1);
      assert.equal((await storage.store.get(queued.id))?.status, 'review');
      assert.equal(await storage.jobs.countPending(), 0);
      assert.equal(await worker.tick(), false);
      workerStorage.store.verify((await workerStorage.store.get(queued.id))!);
      // A new revision submitted before old acknowledgement must remain pending.
      const revision = (await storage.store.get(queued.id))!;
      revision.status = 'queued';
      await storage.store.save(revision);
      await storage.jobs.add(queued.id);
      await workerStorage.jobs.complete(queued.id);
      assert.equal(await storage.jobs.countPending(), 1);
      assert.deepEqual(await workerStorage.jobs.completedStages(queued.id), []);
    } finally {
      await workerStorage.close();
    }
    // Kill a real worker process after its first persisted stage, then resume it.
    const crashCase = await newCase(storage.store, {
      title: 'Crash recovery',
      sourceType: 'text',
      useAi: false,
    });
    // Finish the earlier synthetic pending revision before exercising the child worker.
    await pool.query("UPDATE processing_jobs SET status='completed'");
    await storage.jobs.add(crashCase.id);
    const childEnvironment = { ...process.env, DATABASE_URL: schemaUrl.href, DATA_DIR: directory };
    const child = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/crash-worker.ts'], {
      env: childEnvironment,
    });
    const childExited = once(child, 'exit');
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('worker readiness timeout')), 10000);
        child.stdout.on('data', (chunk: Buffer) => {
          if (chunk.toString().includes('READY_TO_KILL')) {
            clearTimeout(timeout);
            resolve();
          }
        });
        child.once('exit', () => {
          clearTimeout(timeout);
          reject(new Error('worker exited before checkpoint'));
        });
        child.once('error', reject);
      });
    } finally {
      child.kill('SIGKILL');
      await childExited;
    }
    const resumed = spawn(process.execPath, ['--import', 'tsx', 'tests/fixtures/crash-worker.ts'], {
      env: { ...childEnvironment, RESUMED: '1' },
    });
    const [exitCode] = await once(resumed, 'exit');
    assert.equal(exitCode, 0);
    const recovered = (await storage.store.get(crashCase.id))!;
    assert.equal(recovered.status, 'review');
    assert.equal(recovered.evidence.length, 1);
    storage.store.verify(recovered);
    assert.equal(await storage.jobs.countPending(), 0);
    // An API crash during revision intake must not reuse the previous revision's checkpoint.
    await pool.query("UPDATE processing_jobs SET status='running' WHERE case_id=$1", [
      crashCase.id,
    ]);
    await startRevision(storage.store, recovered, 'basic');
    assert.ok((await storage.jobs.interruptedIntakes()).includes(crashCase.id));
    assert.equal(await storage.jobs.claim(), undefined);
    await new InterruptedIntakeRecovery(storage.store).recover(
      await storage.jobs.interruptedIntakes(),
    );
    assert.equal((await storage.store.get(crashCase.id))?.status, 'failed');
    const repository = new PostgresCaseRepository(pool);
    assert.equal(await repository.get('missing'), undefined);
    assert.equal((await repository.list()).find((item) => item.id === record.id)?.evidenceCount, 1);
  } finally {
    await closeRuntime?.();
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
    rmSync(directory, { recursive: true, force: true });
  }
});
