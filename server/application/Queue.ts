import type { CaseProcessor, JobQueue } from './ports/processing.ts';

/** Serial scheduler. Collection and analysis belong to the injected processor. */
export class Queue implements JobQueue {
  private readonly pending: string[] = [];
  private running = false;

  constructor(private readonly processor: CaseProcessor) {}

  get pendingCount(): number {
    return this.pending.length;
  }

  add(id: string): void {
    this.pending.push(id);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) await this.processor.run(this.pending.shift()!);
    } finally {
      this.running = false;
    }
  }
}
