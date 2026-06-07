export type DatabaseRow = Record<string, unknown>;

export type DatabaseHealth = {
  ok: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
};

export type DatabaseQueryResult<T extends DatabaseRow = DatabaseRow> = {
  rows: T[];
  rowCount: number;
};

export interface DatabaseClient {
  query<T extends DatabaseRow = DatabaseRow>(text: string, params?: unknown[]): Promise<DatabaseQueryResult<T>>;
  transaction?<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>;
  health(): Promise<DatabaseHealth>;
  close(): Promise<void>;
}
