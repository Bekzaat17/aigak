import { startWorker } from './bootstrap/start-worker.ts';

startWorker().catch(() => {
  console.error('WORKER_FAILED');
  process.exitCode = 1;
});
