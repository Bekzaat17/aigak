import path from 'node:path';
import { processingWatchdog } from './processing-watchdog.ts';
import { workerHeartbeat } from './worker-heartbeat.ts';
import { setTimeout } from 'node:timers/promises';
import { ProcessingWorker } from '../application/processing/ProcessingWorker.ts';
import { createAiAnalyzer } from '../inspection/provider.ts';
import { createPostgresStorage } from './create-postgres-storage.ts';
import { createCaseProcessor } from './create-case-processor.ts';

export async function startWorker(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  const timeoutMs = Number(process.env.PROCESSING_TIMEOUT_MS || 1800000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 2147483647)
    throw new Error('INVALID_PROCESSING_TIMEOUT');
  const directory = path.resolve(process.env.DATA_DIR || 'data');
  const storage = await createPostgresStorage(directory, process.env.DATABASE_URL, 'worker');
  const stopHeartbeat = workerHeartbeat();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    const processor = createCaseProcessor(
      storage.store,
      directory,
      createAiAnalyzer(),
      storage.jobs,
    );
    const worker = new ProcessingWorker(storage.jobs, processor, processor);
    console.log('aigak worker ready');
    while (!controller.signal.aborted) {
      const cancelWatchdog = processingWatchdog(timeoutMs);
      let processed: boolean;
      try {
        processed = await worker.tick();
      } finally {
        cancelWatchdog();
      }
      if (processed) continue;
      await setTimeout(1000, undefined, { signal: controller.signal }).catch((error: unknown) => {
        if (!controller.signal.aborted) throw error;
      });
    }
  } finally {
    stopHeartbeat();
    process.off('SIGTERM', stop);
    process.off('SIGINT', stop);
    await storage.close();
  }
}
