import { config } from "./config.js";
import { createPostgresDatabaseClient, getPostgresConfig, runDatabaseMigrations } from "./database/index.js";
import { createApp } from "./server/create-app.js";
import { createDependencies } from "./server/dependencies.js";

const database = createPostgresDatabaseClient(getPostgresConfig());
if (config.DATABASE_RUN_MIGRATIONS) {
  await runDatabaseMigrations(database);
}

const app = await createApp({
  logger: true,
  dependencies: createDependencies({
    database,
    persistence: "postgres",
  }),
});

await app.listen({
  port: config.API_PORT,
  host: config.API_HOST,
});

const shutdown = async () => {
  await app.close();
  await database.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
