import type { FastifyInstance } from "fastify";
import type { DatabaseClient } from "../database/index.js";

export async function registerHealthRoutes(app: FastifyInstance, database: DatabaseClient) {
  app.get("/health", async () => ({
    ok: true,
    service: "nomduchat-api",
    version: "0.1.0",
  }));

  app.get("/health/database", async (_request, reply) => {
    const health = await database.health();
    return reply.status(health.ok ? 200 : 503).send({
      service: "postgres",
      ...health,
    });
  });
}
