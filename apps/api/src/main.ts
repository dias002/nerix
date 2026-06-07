import { config } from "./config.js";
import { createPostgresDatabaseClient, getPostgresConfig, runDatabaseMigrations } from "./database/index.js";
import { createApp } from "./server/create-app.js";
import { createDependencies } from "./server/dependencies.js";

const database = createPostgresDatabaseClient(getPostgresConfig());
await runDatabaseMigrations(database);

const app = await createApp({
  logger: true,
  dependencies: createDependencies({
    database,
    persistence: "postgres",
  }),
});

await app.listen({
  port: config.API_PORT,
  host: "127.0.0.1",
});

const shutdown = async () => {
  await app.close();
  await database.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
