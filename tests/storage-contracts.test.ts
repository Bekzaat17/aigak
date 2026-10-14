import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { CaseRecord } from '../shared/types.ts';
import type { BlobStorage } from '../server/application/ports/blobs.ts';
import type { CaseRepository } from '../server/application/ports/storage.ts';
import type { TemplateEntry, TemplateRepository } from '../server/application/ports/templates.ts';
import { newCase } from '../server/application/create-case.ts';
import { AuditLog } from '../server/application/storage/AuditLog.ts';
import { CaseIntegrityVerifier } from '../server/application/storage/CaseIntegrityVerifier.ts';
import { EvidenceService } from '../server/application/storage/EvidenceService.ts';
import { Store } from '../server/application/storage/Store.ts';
import { Templates } from '../server/application/templates/Templates.ts';
import { createLocalStorage } from '../server/bootstrap/create-local-storage.ts';
import { sha256 } from '../server/domain/sha256.ts';
import { FileBlobStorage } from '../server/storage/FileBlobStorage.ts';
import { defaultTemplate } from '../server/templates/default-template.ts';

function memoryBlobs(): BlobStorage {
  const objects = new Map<string, Buffer>();
  return {
    write(namespace, name, bytes) {
      const key = `${namespace}/${name}`;
      if (objects.has(key)) throw new Error('EXISTS');
      objects.set(key, Buffer.from(bytes));
    },
    read(namespace, name) {
      const bytes = objects.get(`${namespace}/${name}`);
      if (!bytes) throw new Error('NOT_FOUND');
      return Buffer.from(bytes);
    },
  };
}

for (const adapter of ['memory', 'files'] as const) {
  test(`${adapter} blob adapter preserves bytes, isolates namespaces and rejects overwrites`, () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'aigak-blob-contract-'));
    try {
      const blobs = adapter === 'memory' ? memoryBlobs() : new FileBlobStorage(directory);
      const input = Buffer.from([0, 255, 128, 12]);
      blobs.write('case-a', 'original.bin', input);
      blobs.write('case-b', 'original.bin', Buffer.from('other'));
      input.fill(3);
      assert.deepEqual(blobs.read('case-a', 'original.bin'), Buffer.from([0, 255, 128, 12]));
      assert.equal(blobs.read('case-b', 'original.bin').toString(), 'other');
      assert.throws(() => blobs.write('case-a', 'original.bin', Buffer.from('overwrite')));
      const read = blobs.read('case-a', 'original.bin');
      read.fill(9);
      assert.equal(blobs.read('case-a', 'original.bin')[0], 0);
      assert.throws(() => blobs.read('missing', 'original.bin'));
      if (adapter === 'files')
        assert.equal(statSync(path.join(directory, 'case-a/original.bin')).mode & 0o777, 0o400);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('case services work with substituted persistence and reject audit or evidence tampering', async () => {
  const records = new Map<string, CaseRecord>();
  const repository: CaseRepository = {
    nextNumber: async (year) => `AG-${year}-0001`,
    all: async () => [...records.values()].map((record) => structuredClone(record)),
    list: async () => [],
    get: async (id) => {
      const record = records.get(id);
      return record && structuredClone(record);
    },
    save: async (record) => {
      records.set(record.id, structuredClone(record));
    },
  };
  const audit = new AuditLog(repository);
  const evidence = new EvidenceService(memoryBlobs(), audit);
  const store = new Store(repository, audit, evidence, new CaseIntegrityVerifier(evidence));
  const record = await newCase(store, { title: 'Memory', sourceType: 'text', useAi: false });
  const original = await store.addEvidence(record, Buffer.from('source'), {
    name: 'source.txt',
    mime: 'text/plain',
    kind: 'original',
    method: 'test',
  });
  const restored = (await store.get(record.id))!;
  assert.equal(restored.evidence[0].sha256, sha256(Buffer.from('source')));
  assert.equal(restored.audit.at(-1)?.action, 'evidence.saved');
  assert.equal(store.read(restored, original).toString(), 'source');
  store.verify(restored);
  restored.audit[0].detail = 'tampered';
  assert.throws(() => store.verify(restored), /INTEGRITY_FAILED/);
  const corrupted = (await store.get(record.id))!;
  corrupted.evidence[0].sha256 = 'wrong';
  assert.throws(() => store.verify(corrupted), /INTEGRITY_FAILED/);
});

test('template catalog substitutes validator, repository, blobs and builtin independently', async () => {
  const entries = new Map<string, TemplateEntry>();
  const repository: TemplateRepository = {
    list: async () => [...entries.values()],
    get: async (id) => entries.get(id),
    findByHash: async (hash) => [...entries.values()].find((entry) => entry.sha256 === hash),
    save: async (entry) => {
      entries.set(entry.id, entry);
    },
  };
  let validationCalls = 0;
  const blobs = memoryBlobs();
  const templates = new Templates(
    repository,
    blobs,
    {
      validate: (bytes) => {
        validationCalls++;
        if (bytes.toString() === 'invalid') throw new Error('INVALID_TEMPLATE');
      },
    },
    { raw: async (lang) => Buffer.from(`builtin:${lang}`) },
  );
  const entry = await templates.add('Custom', Buffer.from('valid'));
  assert.equal((await templates.add('Duplicate', Buffer.from('valid'))).id, entry.id);
  assert.equal(validationCalls, 2);
  assert.equal((await templates.list()).length, 2);
  assert.ok(await templates.has(entry.id));
  assert.equal((await templates.raw(entry.id)).toString(), 'valid');
  assert.equal((await templates.raw('builtin', 'kk')).toString(), 'builtin:kk');
  await assert.rejects(
    async () => await templates.add('Invalid', Buffer.from('invalid')),
    /INVALID_TEMPLATE/,
  );
  assert.equal((await templates.list()).length, 2);
  await assert.rejects(templates.raw('missing'), /NOT_FOUND/);
  entries.set(entry.id, { ...entry, sha256: 'tampered' });
  await assert.rejects(templates.raw(entry.id), /INTEGRITY_FAILED/);
});

test('local adapters read the previous SQLite and file layout without migrating stored bytes', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aigak-legacy-storage-'));
  const filename = path.join(directory, 'aigak.sqlite');
  const db = new DatabaseSync(filename);
  const text = Buffer.from('old evidence');
  const raw = await defaultTemplate();
  // Build the old schema directly, independently of the new adapters.
  db.exec(
    'CREATE TABLE cases (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, sha256 TEXT NOT NULL)',
  );
  const event = {
    id: 'event-1',
    at: '2026-01-01',
    action: 'created',
    detail: '',
    previousHash: '0'.repeat(64),
  };
  const record = {
    id: 'old-case',
    title: 'Old',
    useAi: true,
    audit: [{ ...event, hash: sha256(JSON.stringify(event)) }],
    evidence: [{ id: 'original', storedName: 'original.txt', sha256: sha256(text) }],
    findings: [],
  };
  const body = JSON.stringify(record);
  db.prepare('INSERT INTO cases VALUES (?,?)').run(record.id, body);
  db.prepare('INSERT INTO templates VALUES (?,?,?)').run(
    'old-template',
    'Old template',
    sha256(raw),
  );
  db.close();
  mkdirSync(path.join(directory, 'evidence/old-case'), { recursive: true });
  mkdirSync(path.join(directory, 'templates'));
  writeFileSync(path.join(directory, 'evidence/old-case/original.txt'), text);
  const templatePath = path.join(directory, 'templates/old-template.docx');
  writeFileSync(templatePath, raw);
  const storage = createLocalStorage(directory);
  try {
    const loaded = (await storage.store.get('old-case'))!;
    assert.equal(loaded.analysisLevel, 'advanced');
    storage.store.verify(loaded);
    assert.equal((await storage.store.list())[0].evidenceCount, 1);
    assert.deepEqual(await storage.templates.raw('old-template'), raw);
    assert.equal((await storage.templates.add('Duplicate', raw)).id, 'old-template');
    const reader = new DatabaseSync(filename, { readOnly: true });
    try {
      assert.equal(reader.prepare('SELECT body FROM cases WHERE id=?').get('old-case')?.body, body);
    } finally {
      reader.close();
    }
    chmodSync(templatePath, 0o600);
    writeFileSync(templatePath, 'tampered');
    await assert.rejects(storage.templates.raw('old-template'), /INTEGRITY_FAILED/);
  } finally {
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('failed immutable write leaves evidence metadata and audit unchanged', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aigak-write-failure-'));
  const storage = createLocalStorage(directory);
  // A repository is unnecessary for this operation: the audit port must never be reached.
  try {
    const record = await newCase(storage.store, {
      title: 'Failed write',
      sourceType: 'text',
      useAi: false,
    });
    const snapshot = structuredClone(record);
    const evidence = new EvidenceService(
      {
        write: () => {
          throw new Error('DISK_FULL');
        },
        read: () => {
          throw new Error('NOT_FOUND');
        },
      },
      { event: () => assert.fail('must not audit unsaved evidence') },
    );
    await assert.rejects(
      () =>
        evidence.addEvidence(record, Buffer.from('data'), {
          name: 'data.txt',
          mime: 'text/plain',
          kind: 'original',
          method: 'test',
        }),
      /DISK_FULL/,
    );
    assert.deepEqual(record, snapshot);
  } finally {
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
