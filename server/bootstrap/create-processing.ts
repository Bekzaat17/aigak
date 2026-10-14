import type { CaseStore } from '../application/ports/storage.ts';
import type { AiAnalyzer } from '../inspection/contracts.ts';
import { Queue } from '../application/Queue.ts';
import { createCaseProcessor } from './create-case-processor.ts';

/** SQLite compatibility runtime used by local tests. */
export async function createProcessing(store: CaseStore, directory: string, ai?: AiAnalyzer) {
  const processor = createCaseProcessor(store, directory, ai);
  await processor.recoverInterrupted();
  return { processor, queue: new Queue(processor) };
}
