import type { Pool } from 'pg';

/** Shared by startup and import; serializes schema changes without extensions. */
export async function migratePostgresSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(834172, 1)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = await client.query('SELECT version FROM schema_migrations WHERE version=1');
    if (!applied.rowCount) {
      // TEXT preserves the JSON key order used by legacy audit and revision hashes.
      await client.query(`
        CREATE TABLE cases (
          id text PRIMARY KEY,
          ordinal bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
          body text NOT NULL CHECK (json_typeof(body::json) = 'object')
        );
        CREATE TABLE templates (
          id text PRIMARY KEY,
          ordinal bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
          name text NOT NULL,
          sha256 text NOT NULL
        );
        CREATE INDEX templates_sha256_idx ON templates(sha256);
        CREATE SEQUENCE case_number_seq;
        INSERT INTO schema_migrations(version) VALUES(1);
      `);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
