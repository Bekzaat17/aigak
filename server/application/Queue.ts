import type { CaseProcessor, JobQueue } from './ports/processing.ts';

/** Serial scheduler. Collection and analysis belong to the injected processor. */
export class Queue implements JobQueue {
  private readonly pending: string[] = [];
  private running = false;
  private readonly idleWaiters = new Set<() => void>();

  whenIdle(): Promise<void> {
    if (!this.running && !this.pending.length) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }

  constructor(private readonly processor: CaseProcessor) {}

  async countPending(): Promise<number> {
    return this.pending.length;
  }

  async add(id: string): Promise<void> {
    this.pending.push(id);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        try {
          await this.processor.run(this.pending.shift()!);
        } catch {
          console.error('PROCESSING_STORAGE_FAILED');
        }
      }
    } finally {
      this.running = false;
      for (const resolve of this.idleWaiters) resolve();
      this.idleWaiters.clear();
    }
  }
}
