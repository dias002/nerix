import pg from "pg";
import type { DatabaseClient, DatabaseHealth, DatabaseQueryResult } from "./database.types.js";
import type { PostgresConfig } from "./postgres.config.js";

const { Pool } = pg;

export class PostgresDatabaseClient implements DatabaseClient {
  private readonly pool: pg.Pool;

  constructor(config: PostgresConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: unknown[] = []
  ): Promise<DatabaseQueryResult<T>> {
    const result = await this.pool.query<T>(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async health(): Promise<DatabaseHealth> {
    const startedAt = Date.now();

    try {
      await this.query("select 1 as ok");
      return {
        ok: true,
        configured: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  async close() {
    await this.pool.end();
  }
}

export function createPostgresDatabaseClient(config: PostgresConfig) {
  return new PostgresDatabaseClient(config);
}
