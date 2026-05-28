import { config } from "../config.js";

export type PostgresConfig = {
  connectionString: string;
  maxConnections: number;
  ssl: boolean;
};

export function getPostgresConfig(): PostgresConfig {
  return {
    connectionString: config.DATABASE_URL,
    maxConnections: config.DATABASE_MAX_CONNECTIONS,
    ssl: config.DATABASE_SSL,
  };
}

