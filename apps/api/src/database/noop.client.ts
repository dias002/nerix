import type { DatabaseClient, DatabaseHealth, DatabaseQueryResult } from "./database.types.js";

export class NoopDatabaseClient implements DatabaseClient {
  async query<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<DatabaseQueryResult<T>> {
    throw new Error("Database is not configured for this app instance.");
  }

  async health(): Promise<DatabaseHealth> {
    return {
      ok: false,
      configured: false,
      error: "Database client was not provided.",
    };
  }

  async close() {
    return undefined;
  }
}
