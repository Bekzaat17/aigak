import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProcessingWorker } from '../server/application/processing/ProcessingWorker.ts';

test('worker acknowledges only completed processing and leaves a failed job for recovery', async () => {
  const acknowledged: string[] = [];
  const jobs = {
    claim: async () => ({ id: 'case', attempt: 1 }),
    complete: async (id: string) => {
      acknowledged.push(id);
    },
  };
  const failures = {
    fail: async () => {
      throw new Error('unexpected');
    },
  };
  const failing = new ProcessingWorker(
    jobs,
    {
      run: async () => {
        throw new Error('database offline');
      },
    },
    failures,
  );
  await assert.rejects(failing.tick(), /database offline/);
  assert.deepEqual(acknowledged, []);
  const recovered = new ProcessingWorker(jobs, { run: async () => {} }, failures);
  assert.equal(await recovered.tick(), true);
  assert.deepEqual(acknowledged, ['case']);
});

test('worker bounds recovery attempts and does not execute exhausted tasks', async () => {
  const events: string[] = [];
  const worker = new ProcessingWorker(
    {
      claim: async () => ({ id: 'case', attempt: 4 }),
      complete: async () => {
        events.push('complete');
      },
    },
    {
      run: async () => {
        throw new Error('must not execute');
      },
    },
    {
      fail: async (id, code) => {
        events.push(`${id}:${code}`);
      },
    },
  );
  await worker.tick();
  assert.deepEqual(events, ['case:RETRY_LIMIT_REACHED', 'complete']);
});
