import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { createLocalStorage } from '../server/bootstrap/create-local-storage';
import { newCase } from '../server/application/create-case';
import { CollectionOrchestrator } from '../server/application/collection/CollectionOrchestrator';
import { IsolatedCollectionStrategy } from '../server/collection/IsolatedCollectionStrategy';
import { reviewCollectionAttempt } from '../server/domain/review-collection-attempt';
import { CaseProcessingService } from '../server/application/processing/CaseProcessingService';
import { ScopedCaseStore } from '../server/application/processing/ScopedCaseStore';

async function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'aigak-agent-'));
  const storage = createLocalStorage(dir);
  const record = await newCase(storage.store, {
    title: 'Agent test',
    sourceType: 'url',
    sourceUrl: 'https://example.com',
    useAi: true,
    analysisLevel: 'pro',
  });
  return {
    ...storage,
    record,
    cleanup() {
      storage.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('parallel collectors are isolated; supervisor commits remapped evidence and invokes fallback', async () => {
  const f = await fixture();
  try {
    let running = 0,
      peak = 0;
    const strategy = (id: string, adequate: boolean) =>
      new IsolatedCollectionStrategy(id, 1000, (store) => ({
        id,
        collect: async (c) => {
          assert.equal(c.evidence.length, 0);
          running++;
          peak = Math.max(peak, running);
          await setTimeout(10);
          const parent = await store.addEvidence(c, Buffer.from('<body>fixture</body>'), {
            name: 'page.html',
            mime: 'text/html',
            kind: 'snapshot',
            method: id,
          });
          await store.addEvidence(c, Buffer.from('text'), {
            name: 'page.txt',
            mime: 'text/plain',
            kind: 'text',
            method: id,
            parentId: parent.id,
            text: adequate
              ? 'Visible website content about rules and casino games '.repeat(30)
              : 'Loading',
          });
          running--;
        },
      }));
    await new CollectionOrchestrator(
      f.store,
      [
        { fallback: false, strategies: [strategy('first', false), strategy('second', false)] },
        { fallback: true, strategies: [strategy('backup', true)] },
      ],
      reviewCollectionAttempt,
      3000,
    ).collect(f.record);
    assert.equal(peak, 2);
    assert.deepEqual(
      f.record.collection?.attempts.map((a) => a.method),
      ['first', 'second', 'backup'],
    );
    assert.equal(f.record.collection?.status, 'adequate');
    assert.equal(f.record.evidence.length, 6);
    for (const e of f.record.evidence.filter((e) => e.kind === 'text'))
      assert.ok(f.record.evidence.some((p) => p.id === e.parentId));
    f.store.verify(f.record);
  } finally {
    f.cleanup();
  }
});

test('a timed out stage cannot mutate or save the final case; later stages still run', async () => {
  const f = await fixture();
  try {
    const guarded = new ScopedCaseStore(f.store);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let lateError = '';
    let settled!: () => void;
    const finished = new Promise<void>((resolve) => {
      settled = resolve;
    });
    const processor = new CaseProcessingService(
      guarded,
      [
        {
          id: 'stalled',
          execute: async (c) => {
            await gate;
            c.title = 'late overwrite';
            try {
              await guarded.save(c);
            } catch (e) {
              lateError = (e as Error).message;
            }
            settled();
          },
        },
        {
          id: 'finish',
          execute: async (c) => {
            c.title = 'final report';
            await guarded.save(c);
          },
        },
      ],
      undefined,
      undefined,
      { budgetMs: 1000, stageBudgets: { stalled: 15, finish: 100 }, scope: guarded },
    );
    await processor.run(f.record.id);
    release();
    await finished;
    const result = (await f.store.get(f.record.id))!;
    assert.equal(result.title, 'final report');
    assert.equal(result.status, 'review');
    assert.equal(result.scenarioRun?.status, 'partial');
    assert.equal(result.scenarioRun?.actions[0].reason, 'STAGE_DEADLINE');
    assert.ok(['STAGE_CLOSED', 'STAGE_DEADLINE'].includes(lateError));
    f.store.verify(result);
  } finally {
    f.cleanup();
  }
});

test('OTP handoff shares a code across API and worker adapters and deletes it after consumption', async () => {
  const { FileAuthChallenges } = await import('../server/auth/FileAuthChallenges');
  const { randomUUID } = await import('node:crypto');
  const { readdirSync } = await import('node:fs');
  const dir = mkdtempSync(path.join(tmpdir(), 'aigak-otp-'));
  try {
    const worker = new FileAuthChallenges(dir),
      api = new FileAuthChallenges(dir);
    const id = randomUUID();
    const pending = worker.requestCode(id, AbortSignal.timeout(3000));
    const challenge = api.get(id)!;
    assert.equal(challenge.kind, 'otp');
    assert.throws(() => api.submit(id, randomUUID(), '123456'), /INVALID_CHALLENGE/);
    api.submit(id, challenge.id, '123456');
    assert.equal(await pending, '123456');
    assert.equal(api.get(id), null);
    assert.deepEqual(readdirSync(path.join(dir, 'auth-interactions')), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('worker recovery preserves the original scenario deadline and prior trace', async () => {
  const f = await fixture();
  try {
    const guarded = new ScopedCaseStore(f.store);
    const prior = {
      role: 'orchestrator',
      action: 'already-finished',
      status: 'completed' as const,
      startedAt: new Date().toISOString(),
      durationMs: 1,
    };
    f.record.scenarioRun = {
      version: '1.0.0',
      status: 'running',
      startedAt: new Date(Date.now() - 5000).toISOString(),
      deadlineAt: new Date(Date.now() - 1000).toISOString(),
      actions: [prior],
    };
    await f.store.save(f.record);
    let calls = 0;
    const processor = new CaseProcessingService(
      guarded,
      [
        {
          id: 'never',
          execute: async () => {
            calls++;
          },
        },
      ],
      undefined,
      undefined,
      { budgetMs: 400000, stageBudgets: {}, scope: guarded },
    );
    await processor.run(f.record.id);
    const c = (await f.store.get(f.record.id))!;
    assert.equal(calls, 0);
    assert.equal(c.scenarioRun?.deadlineAt, f.record.scenarioRun.deadlineAt);
    assert.deepEqual(c.scenarioRun?.actions, [prior]);
    assert.equal(c.scenarioRun?.status, 'partial');
  } finally {
    f.cleanup();
  }
});

test('scoped writes preserve repository object identity across stages and final commit', async () => {
  const f = await fixture();
  try {
    const tracked = new WeakSet<object>();
    const durable = {
      nextNumber: f.store.nextNumber.bind(f.store),
      all: f.store.all.bind(f.store),
      list: f.store.list.bind(f.store),
      addEvidence: f.store.addEvidence.bind(f.store),
      read: f.store.read.bind(f.store),
      verify: f.store.verify.bind(f.store),
      get: async (id: string) => {
        const record = await f.store.get(id);
        if (record) tracked.add(record);
        return record;
      },
      save: async (record: typeof f.record) => {
        assert.ok(tracked.has(record), 'repository concurrency token belongs to original object');
        await f.store.save(record);
      },
      event: async (record: typeof f.record, action: string, detail?: string) => {
        assert.ok(tracked.has(record), 'audit writes retain repository identity');
        await f.store.event(record, action, detail);
      },
    };
    const scoped = new ScopedCaseStore(durable);
    const processor = new CaseProcessingService(
      scoped,
      [
        {
          id: 'first',
          execute: async (record) => {
            record.title = 'First stage';
            await scoped.save(record);
          },
        },
        {
          id: 'second',
          execute: async (record) => {
            assert.equal(record.title, 'First stage');
            record.title = 'Second stage';
            await scoped.event(record, 'fixture');
          },
        },
      ],
      undefined,
      undefined,
      { budgetMs: 1000, stageBudgets: {}, scope: scoped },
    );
    await processor.run(f.record.id);
    const saved = await f.store.get(f.record.id);
    assert.equal(saved?.status, 'review');
    assert.equal(saved?.title, 'Second stage');
    assert.equal(saved?.scenarioRun?.actions.length, 2);
  } finally {
    f.cleanup();
  }
});
