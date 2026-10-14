import path from 'node:path';
import { Pool } from 'pg';
import { importSqlite } from '../server/storage/postgres/import-sqlite.ts';

const source = process.argv[2];
if (!source || !process.env.DATABASE_URL) {
  console.error('Usage: DATABASE_URL=... npm run db:import -- /absolute/path/aigak.sqlite');
  process.exitCode = 1;
} else {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    console.log(await importSqlite(pool, path.resolve(source)));
  } catch (error) {
    console.error(
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : 'MIGRATION_FAILED',
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
