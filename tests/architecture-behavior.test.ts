import { CaseDocumentService } from '../server/application/CaseDocumentService.ts';
import multer from 'multer';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Queue } from '../server/application/Queue.ts';
import { newCase } from '../server/application/create-case.ts';
import { CaseProcessingService } from '../server/application/processing/CaseProcessingService.ts';
import { FileExtractionService } from '../server/collection/FileExtractionService.ts';
import type { FileExtractor } from '../server/collection/contracts.ts';
import type { HttpDependencies } from '../server/http/contracts.ts';
import { createApp } from '../server/http/create-app.ts';
import { AdvancedStrategy } from '../server/inspection/strategies/AdvancedStrategy.ts';
import { BasicStrategy } from '../server/inspection/strategies/BasicStrategy.ts';
import { ProStrategy } from '../server/inspection/strategies/ProStrategy.ts';
import { StrategyFactory } from '../server/inspection/strategies/StrategyFactory.ts';
import { createLocalStorage } from '../server/bootstrap/create-local-storage.ts';

async function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'aigak-architecture-'));
  const storage = createLocalStorage(directory);
  const { store } = storage;
  const record = await newCase(store, {
    title: 'Architecture test',
    sourceType: 'text',
    useAi: false,
  });
  return {
    store,
    record,
    close: () => {
      storage.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('queue schedules substituted processors serially without knowing storage or analysis', async () => {
  const order: string[] = [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finish!: () => void;
  const completed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const queue = new Queue({
    async run(id) {
      order.push('start:' + id);
      if (id === 'first') await blocked;
      order.push('end:' + id);
      if (id === 'second') finish();
    },
  });
  queue.add('first');
  queue.add('second');
  assert.equal(await queue.countPending(), 1);
  assert.deepEqual(order, ['start:first']);
  release();
  await completed;
  assert.deepEqual(order, ['start:first', 'end:first', 'start:second', 'end:second']);
  assert.equal(await queue.countPending(), 0);
});

test('processing accepts new stages and persists partial evidence on failure', async () => {
  const f = await fixture();
  try {
    let reachedLast = false;
    const processor = new CaseProcessingService(f.store, [
      {
        id: 'stage-1',
        async execute(record) {
          await f.store.addEvidence(record, Buffer.from('retained'), {
            name: 'test.txt',
            mime: 'text/plain',
            kind: 'original',
            method: 'fake-stage',
          });
        },
      },
      {
        id: 'stage-2',
        async execute() {
          throw new Error('FAKE_STAGE_FAILURE');
        },
      },
      {
        id: 'stage-3',
        async execute() {
          reachedLast = true;
        },
      },
    ]);
    await processor.run(f.record.id);
    const result = (await f.store.get(f.record.id))!;
    assert.equal(result.status, 'failed');
    assert.equal(reachedLast, false);
    assert.equal(result.evidence.length, 1);
    assert.equal(result.audit.at(-1)?.action, 'processing.failed');
    f.store.verify(result);
  } finally {
    f.close();
  }
});

test('a new extractor handles a new format without modifying dispatch or using OCR', async () => {
  const f = await fixture();
  try {
    const evidence = await f.store.addEvidence(f.record, Buffer.from('sample'), {
      name: 'sample.custom',
      mime: 'application/x-custom',
      kind: 'original',
      method: 'test',
    });
    const extractor: FileExtractor = {
      supports: (mime) => mime === 'application/x-custom',
      async extract({ store, record, evidence, data }) {
        await store.addEvidence(record, data, {
          name: 'derived.txt',
          mime: 'text/plain',
          kind: 'text',
          text: data.toString(),
          parentId: evidence.id,
          method: 'custom',
        });
      },
    };
    await new FileExtractionService(f.store, [extractor]).extract(f.record, evidence);
    const result = (await f.store.get(f.record.id))!;
    assert.equal(result.evidence[1].text, 'sample');
    assert.equal(result.evidence[1].parentId, evidence.id);
    f.store.verify(result);
  } finally {
    f.close();
  }
});

test('registered strategies preserve the common contract and return independent plans', () => {
  const factory = new StrategyFactory();
  for (const [level, Type] of [
    ['basic', BasicStrategy],
    ['advanced', AdvancedStrategy],
    ['pro', ProStrategy],
  ] as const) {
    const first = factory.create(level),
      second = factory.create(level);
    assert.ok(first instanceof Type);
    assert.equal(first.level, level);
    assert.notEqual(first, second);
    assert.ok(first.timeoutMs > 0);
    assert.ok(first.maxAiCalls >= 0);
    assert.equal(new Set(first.checks).size, first.checks.length);
  }
});

test('HTTP app preserves access checks, intake, review, revisions and injected documents', async (t) => {
  const f = await fixture();
  const queued: string[] = [];
  let pendingCount = 0;
  const dependencies: HttpDependencies = {
    store: f.store,
    queue: {
      async countPending() {
        return pendingCount;
      },
      add: async (id) => {
        queued.push(id);
      },
    },
    templates: {
      list: async () => [],
      has: async (id) => id === 'builtin',
      add: async () => ({ id: 'test', name: 'Test', sha256: '' }),
      raw: async () => Buffer.from('template'),
    },
    aiAnalyzer: { available: false },
    documents: {
      preview: () => '<h1>Injected preview</h1>',
      document: async () => Buffer.from('injected-docx'),
      archive: async () => Buffer.from('injected-zip'),
    },
    upload: multer({
      storage: multer.memoryStorage(),
      limits: { files: 5, fileSize: 10 * 1024 * 1024 },
    }),
  };
  const app = createApp(dependencies, 4317);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    f.close();
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  async function request(
    url: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string }>(
      (resolve, reject) => {
        const request = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: url,
            method,
            headers: {
              Host: 'localhost:4317',
              'Content-Type': 'application/json',
              'X-Aigak-Client': 'local',
              ...headers,
            },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () =>
              resolve({
                status: response.statusCode!,
                headers: response.headers,
                text: Buffer.concat(chunks).toString(),
              }),
            );
          },
        );
        request.on('error', reject);
        request.end(body === undefined ? undefined : JSON.stringify(body));
      },
    );
  }
  assert.equal((await request('/api/health')).status, 200);
  assert.equal(
    (await request('/api/health', 'GET', undefined, { Host: 'untrusted.example' })).status,
    403,
  );
  assert.equal((await request('/api/cases', 'POST', {}, { 'X-Aigak-Client': '' })).status, 403);
  assert.equal(
    (await request('/api/health', 'GET', undefined, { Origin: 'https://untrusted.example' }))
      .status,
    403,
  );
  assert.equal((await request('/api/cases', 'POST', {})).status, 400);
  pendingCount = 20;
  assert.equal((await request('/api/cases', 'POST', {})).status, 429);
  pendingCount = 0;
  const created = await request('/api/cases', 'POST', {
    title: 'HTTP intake',
    sourceType: 'text',
    text: 'Preserved source',
  });
  assert.equal(created.status, 201);
  const record = JSON.parse(created.text);
  assert.deepEqual(queued, [record.id]);
  const persisted = (await f.store.get(record.id))!;
  persisted.status = 'review';
  await f.store.save(persisted);
  const preview = await request(`/api/cases/${record.id}/preview`);
  assert.equal(preview.text, '<h1>Injected preview</h1>');
  assert.match(String(preview.headers['content-security-policy']), /sandbox/);
  assert.equal((await request(`/api/cases/${record.id}/document`)).text, 'injected-docx');
  assert.equal((await request(`/api/cases/${record.id}/export`, 'POST')).text, 'injected-zip');
  const updated = await request(`/api/cases/${record.id}/clarifications/source`, 'PATCH', {
    answer: 'yes',
    note: 'Verified',
  });
  assert.equal(updated.status, 200);
  assert.equal(JSON.parse(updated.text).clarifications[0].answer, 'yes');
  assert.equal(
    (await request(`/api/cases/${record.id}/materials`, 'POST', { text: 'Additional material' }))
      .status,
    200,
  );
  assert.equal((await f.store.get(record.id))?.materialsPending, true);
  const rerun = await request(`/api/cases/${record.id}/reanalyze`, 'POST', {
    analysisLevel: 'basic',
  });
  assert.equal(rerun.status, 202);
  assert.equal(JSON.parse(rerun.text).revisions.length, 1);
  assert.equal(
    (await request(`/api/cases/${record.id}/materials`, 'POST', { text: 'Busy' })).status,
    409,
  );
  const demo = await request('/api/demo', 'POST');
  assert.equal(demo.status, 201);
  assert.equal((await request('/api/demo', 'POST')).status, 200);
  assert.equal((await request('/api/missing')).status, 404);
});

test('document use case substitutes report layout independently of renderer and package builder', async () => {
  const f = await fixture();
  try {
    const documents = new CaseDocumentService(
      f.store,
      { raw: async () => Buffer.from('template') },
      {
        render: (_template, fields) => Buffer.from(String(fields.title)),
      },
      { build: async () => ({ bytes: Buffer.from('archive'), warnings: [], files: [] }) },
      {
        id: 'custom',
        html: (record, lang) => `${record.id}:${lang}`,
        fields: (_record, lang) => ({ title: lang }),
      },
    );
    assert.equal(documents.preview(f.record, 'kk'), `${f.record.id}:kk`);
    assert.equal((await documents.document(f.record, 'ru')).toString(), 'ru');
  } finally {
    f.close();
  }
});
