import { Pool } from 'pg';
import { PostgresExecutor } from '../storage/postgres/PostgresExecutor.ts';
import { PostgresJobQueue } from '../storage/postgres/PostgresJobQueue.ts';
import { PostgresCaseRepository } from '../storage/postgres/PostgresCaseRepository.ts';
import { PostgresTemplateRepository } from '../storage/postgres/PostgresTemplateRepository.ts';
import { migratePostgresSchema } from '../storage/postgres/schema.ts';
import { composeStorage } from './compose-storage.ts';

export async function createPostgresStorage(
  directory: string,
  connectionString: string,
  role: 'api' | 'worker' = 'api',
) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', () => console.error('POSTGRES_CONNECTION_LOST'));
  const lockKey = role === 'api' ? 2 : 3;
  let lease;
  try {
    await migratePostgresSchema(pool);
    // One API and one worker may coexist; duplicate workers must never execute a job.
    lease = await pool.connect();
    lease.on('error', () => {
      console.error('POSTGRES_LEASE_LOST');
      process.exit(1);
    });
    const result = await lease.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock(834172, $1) AS acquired',
      [lockKey],
    );
    if (!result.rows[0].acquired) throw new Error('DATABASE_IN_USE');
    const executor = new PostgresExecutor(pool);
    const storage = composeStorage(
      directory,
      new PostgresCaseRepository(executor),
      new PostgresTemplateRepository(executor),
    );
    const activeLease = lease;
    return {
      ...storage,
      jobs: new PostgresJobQueue(executor),
      close: async () => {
        try {
          await activeLease.query('SELECT pg_advisory_unlock(834172, $1)', [lockKey]);
        } finally {
          activeLease.release();
          await pool.end();
        }
      },
    };
  } catch (error) {
    lease?.release();
    await pool.end();
    throw error;
  }
}
