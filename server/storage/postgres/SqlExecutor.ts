import type { QueryResult, QueryResultRow } from 'pg';

export interface SqlExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}
