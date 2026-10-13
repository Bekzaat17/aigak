import type { CaseRecord } from '../../../shared/types.ts';

export interface CaseProcessor {
  run(id: string): Promise<void>;
}

export interface ProcessingStage {
  execute(record: CaseRecord): Promise<void>;
}

export interface JobQueue {
  readonly pendingCount: number;
  add(id: string): void;
}
