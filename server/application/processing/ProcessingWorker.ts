import type {
  CaseProcessor,
  ProcessingJobs,
  ProcessingFailureHandler,
} from '../ports/processing.ts';

/** One tick processes one durable job. Infrastructure failures leave it recoverable. */
export class ProcessingWorker {
  constructor(
    private readonly jobs: ProcessingJobs,
    private readonly processor: CaseProcessor,
    private readonly failures: ProcessingFailureHandler,
    private readonly maxAttempts = 3,
  ) {}

  async tick(): Promise<boolean> {
    const job = await this.jobs.claim();
    if (!job) return false;
    if (job.attempt > this.maxAttempts) await this.failures.fail(job.id, 'RETRY_LIMIT_REACHED');
    else await this.processor.run(job.id);
    await this.jobs.complete(job.id);
    return true;
  }
}
