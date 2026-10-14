import type { Pool, QueryResultRow } from 'pg';
import { StorageFailure } from '../../application/errors/StorageFailure.ts';
import type { SqlExecutor } from './SqlExecutor.ts';

/** Translate driver errors at the infrastructure boundary. */
export class PostgresExecutor implements SqlExecutor {
  constructor(private readonly pool: Pool) {}

  async query<Row extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) {
    try {
      return await this.pool.query<Row>(sql, values);
    } catch (cause) {
      throw new StorageFailure(cause);
    }
  }
}
