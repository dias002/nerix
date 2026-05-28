import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./health.routes.js";
import { createDependencies, type AppDependencies } from "./dependencies.js";
import { registerAgentRoutes } from "../modules/agents/routes.js";
import { registerAiGatewayRoutes } from "../modules/ai-gateway/routes.js";
import { registerBillingRoutes } from "../modules/billing/routes.js";
import { registerChatRoutes } from "../modules/chat/routes.js";
import { registerUserRoutes } from "../modules/users/routes.js";

export type CreateAppOptions = {
  logger?: boolean | FastifyBaseLogger;
  dependencies?: AppDependencies;
};

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });
  const dependencies = options.dependencies ?? createDependencies();

  await app.register(cors, {
    origin: true,
  });

  await registerHealthRoutes(app, dependencies.database);
  await registerUserRoutes(app, dependencies.users);
  await registerBillingRoutes(app, dependencies.billing);
  await registerAgentRoutes(app, dependencies.agents);
  await registerAiGatewayRoutes(app, dependencies.aiGateway);
  await registerChatRoutes(app, dependencies.chat);

  return app;
}
