import type { Pool } from 'pg';
import { initialSchema } from './migrations/001-initial.ts';
import { processingJobs } from './migrations/002-processing-jobs.ts';

export async function migratePostgresSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(834172, 1)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const [index, sql] of [initialSchema, processingJobs].entries()) {
      const version = index + 1;
      const applied = await client.query('SELECT version FROM schema_migrations WHERE version=$1', [
        version,
      ]);
      if (applied.rowCount) continue;
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
