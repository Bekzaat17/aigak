import type { SqlExecutor } from './SqlExecutor.ts';
import type {
  JobQueue,
  ProcessingJobs,
  ProcessingProgress,
} from '../../application/ports/processing.ts';

/** Durable scheduling; the worker's exclusive database lease serializes execution. */
export class PostgresJobQueue implements JobQueue, ProcessingJobs, ProcessingProgress {
  constructor(private readonly db: SqlExecutor) {}

  async countPending(): Promise<number> {
    return this.db
      .query<{ count: string }>("SELECT count(*) FROM processing_jobs WHERE status = 'pending'")
      .then((result) => Number(result.rows[0].count));
  }

  async interruptedIntakes(): Promise<string[]> {
    const result = await this.db.query<{ id: string }>(`SELECT cases.id FROM cases
      LEFT JOIN processing_jobs ON processing_jobs.case_id=cases.id
      WHERE cases.body::json->>'status' IN ('queued','collecting','analyzing')
        AND (processing_jobs.case_id IS NULL OR processing_jobs.status='completed' OR processing_jobs.revision <> COALESCE(json_array_length(cases.body::json->'revisions'), 0))`);
    return result.rows.map((row) => row.id);
  }

  async add(id: string): Promise<void> {
    await this.db.query(
      `INSERT INTO processing_jobs(case_id,revision)
      SELECT id, COALESCE(json_array_length(body::json->'revisions'), 0) FROM cases WHERE id=$1
      ON CONFLICT(case_id) DO UPDATE SET status='pending', revision=EXCLUDED.revision, attempts=0, completed_stages='{}', created_at=now(), updated_at=now()
      WHERE processing_jobs.status='completed' OR (processing_jobs.status='running' AND
        (SELECT body::json->>'status' FROM cases WHERE id=$1)='queued')`,
      [id],
    );
  }

  async claim(): Promise<{ id: string; attempt: number } | undefined> {
    // A revision whose intake never reached add() must not reuse old checkpoints.
    await this.db.query(`UPDATE processing_jobs SET status='completed', updated_at=now()
      FROM cases WHERE cases.id=processing_jobs.case_id AND processing_jobs.status <> 'completed'
      AND processing_jobs.revision <> COALESCE(json_array_length(cases.body::json->'revisions'), 0)`);
    const result = await this.db.query<{
      case_id: string;
      attempts: number;
    }>(`UPDATE processing_jobs
      SET status='running', attempts=attempts+1, updated_at=now()
      WHERE case_id=(SELECT jobs.case_id FROM processing_jobs jobs JOIN cases ON cases.id=jobs.case_id
        WHERE jobs.status <> 'completed' AND jobs.revision=COALESCE(json_array_length(cases.body::json->'revisions'), 0)
        ORDER BY jobs.created_at LIMIT 1)
      RETURNING case_id, attempts`);
    const row = result.rows[0];
    return row && { id: row.case_id, attempt: row.attempts };
  }

  async completedStages(id: string): Promise<string[]> {
    const result = await this.db.query<{ completed_stages: string[] }>(
      'SELECT completed_stages FROM processing_jobs WHERE case_id=$1',
      [id],
    );
    return result.rows[0]?.completed_stages ?? [];
  }

  async checkpoint(id: string, stageId: string): Promise<void> {
    await this.db.query(
      'UPDATE processing_jobs SET completed_stages=array_append(completed_stages, $2), updated_at=now() WHERE case_id=$1',
      [id, stageId],
    );
  }

  async complete(id: string): Promise<void> {
    await this.db.query(
      "UPDATE processing_jobs SET status='completed', updated_at=now() WHERE case_id=$1 AND status='running'",
      [id],
    );
  }
}
