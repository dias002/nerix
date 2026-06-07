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

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const connection = await this.pool.connect();
    const transactionClient = new PostgresTransactionClient(connection);

    try {
      await connection.query("begin");
      const result = await callback(transactionClient);
      await connection.query("commit");
      return result;
    } catch (error) {
      await connection.query("rollback");
      throw error;
    } finally {
      connection.release();
    }
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

class PostgresTransactionClient implements DatabaseClient {
  constructor(private readonly client: pg.PoolClient) {}

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: unknown[] = []
  ): Promise<DatabaseQueryResult<T>> {
    const result = await this.client.query<T>(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async health(): Promise<DatabaseHealth> {
    return {
      ok: true,
      configured: true,
    };
  }

  async close() {
    return undefined;
  }
}

export function createPostgresDatabaseClient(config: PostgresConfig) {
  return new PostgresDatabaseClient(config);
}
