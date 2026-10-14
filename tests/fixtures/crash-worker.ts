import { createPostgresStorage } from '../../server/bootstrap/create-postgres-storage.ts';
import { CaseProcessingService } from '../../server/application/processing/CaseProcessingService.ts';
import { ProcessingWorker } from '../../server/application/processing/ProcessingWorker.ts';

const storage = await createPostgresStorage(
  process.env.DATA_DIR!,
  process.env.DATABASE_URL!,
  'worker',
);
try {
  const processor = new CaseProcessingService(
    storage.store,
    [
      {
        id: 'capture',
        execute: async (record) => {
          if (process.env.RESUMED) throw new Error('CHECKPOINT_NOT_RESTORED');
          await storage.store.addEvidence(record, Buffer.from('durable bytes'), {
            name: 'checkpoint.txt',
            mime: 'text/plain',
            kind: 'original',
            method: 'synthetic-test',
          });
        },
      },
      {
        id: 'finish',
        execute: async () => {
          if (!process.env.RESUMED) {
            console.log('READY_TO_KILL');
            await new Promise(() => {
              setInterval(() => {}, 1000);
            });
          }
        },
      },
    ],
    storage.jobs,
  );
  await new ProcessingWorker(storage.jobs, processor, processor).tick();
} finally {
  await storage.close();
}
