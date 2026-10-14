import type { CaseRecord } from '../../../shared/types.ts';

export interface CaseProcessor {
  run(id: string): Promise<void>;
}

export interface ProcessingStage {
  readonly id: string;
  execute(record: CaseRecord): Promise<void>;
}

export interface JobQueue {
  /** Waiting tasks only; excludes the task currently being processed. */
  countPending(): Promise<number>;
  add(id: string): Promise<void>;
}

export interface ProcessingJobs {
  claim(): Promise<{ id: string; attempt: number } | undefined>;
  complete(id: string): Promise<void>;
}

export interface ProcessingProgress {
  completedStages(id: string): Promise<string[]>;
  checkpoint(id: string, stageId: string): Promise<void>;
}

export interface ProcessingFailureHandler {
  fail(id: string, code: string): Promise<void>;
}
