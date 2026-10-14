import { Pool } from 'pg';
import { migratePostgresSchema } from '../server/storage/postgres/schema.ts';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migratePostgresSchema(pool);
  console.log('Database migrations applied');
} finally {
  await pool.end();
}
