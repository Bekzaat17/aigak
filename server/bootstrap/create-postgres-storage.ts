import { Pool } from 'pg';
import { PostgresCaseRepository } from '../storage/postgres/PostgresCaseRepository.ts';
import { PostgresTemplateRepository } from '../storage/postgres/PostgresTemplateRepository.ts';
import { migratePostgresSchema } from '../storage/postgres/schema.ts';
import { composeStorage } from './compose-storage.ts';

export async function createPostgresStorage(directory: string, connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', () => console.error('POSTGRES_CONNECTION_LOST'));
  let lease;
  try {
    await migratePostgresSchema(pool);
    // The processing queue is still single-process; do not recover another server's jobs.
    lease = await pool.connect();
    lease.on('error', () => {
      console.error('POSTGRES_LEASE_LOST');
      process.exit(1);
    });
    const result = await lease.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock(834172, 2) AS acquired',
    );
    if (!result.rows[0].acquired) throw new Error('DATABASE_IN_USE');
    const storage = composeStorage(
      directory,
      new PostgresCaseRepository(pool),
      new PostgresTemplateRepository(pool),
    );
    const activeLease = lease;
    return {
      ...storage,
      close: async () => {
        try {
          await activeLease.query('SELECT pg_advisory_unlock(834172, 2)');
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
