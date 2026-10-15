import type { CaseRecord } from '../../../shared/types';
export interface StageScope {
  begin(record: CaseRecord, signal: AbortSignal): void;
  drain(record: CaseRecord): Promise<void>;
}
export interface ProcessingExecutionPolicy {
  budgetMs: number;
  stageBudgets: Readonly<Record<string, number>>;
  scope: StageScope;
}
export interface ProcessingContext {
  signal: AbortSignal;
  deadlineAt: number;
}
