import { createPostgresDatabaseClient, getPostgresConfig, runDatabaseMigrations } from "./database/index.js";

const database = createPostgresDatabaseClient(getPostgresConfig());

try {
  await runDatabaseMigrations(database);
} finally {
  await database.close();
}
