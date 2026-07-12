import { config } from "./config.js";
import { createPostgresDatabaseClient, getPostgresConfig, runDatabaseMigrations } from "./database/index.js";
import { createApp } from "./server/create-app.js";
import { createDependencies } from "./server/dependencies.js";

const database = config.API_PERSISTENCE === "postgres" ? createPostgresDatabaseClient(getPostgresConfig()) : null;
if (database && config.DATABASE_RUN_MIGRATIONS) {
  await runDatabaseMigrations(database);
}

const app = await createApp({
  logger: true,
  dependencies: database
    ? createDependencies({
        database,
        persistence: "postgres",
      })
    : createDependencies({
        persistence: "memory",
      }),
});

app.log.info({ persistence: config.API_PERSISTENCE }, "nomduchat API persistence mode");

await app.listen({
  port: config.API_PORT,
  host: config.API_HOST,
});

const shutdown = async () => {
  await app.close();
  await database?.close();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
