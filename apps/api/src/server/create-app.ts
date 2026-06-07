import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerHealthRoutes } from "./health.routes.js";
import { createDependencies, type AppDependencies } from "./dependencies.js";
import { registerAdminRoutes } from "../modules/admin/routes.js";
import { registerAgentRoutes } from "../modules/agents/routes.js";
import { registerAiGatewayRoutes } from "../modules/ai-gateway/routes.js";
import { registerAuthRoutes } from "../modules/auth/routes.js";
import { registerBillingRoutes } from "../modules/billing/routes.js";
import { registerBusinessRoutes } from "../modules/business/routes.js";
import { registerChatRoutes } from "../modules/chat/routes.js";
import { registerMailingRoutes } from "../modules/mailings/routes.js";
import { registerSubscriptionRoutes } from "../modules/subscriptions/routes.js";
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
  await registerAuthRoutes(app, dependencies.auth);
  await registerUserRoutes(app, dependencies.users, dependencies.auth);
  await registerAdminRoutes(app, dependencies.admin, dependencies.auth);
  await registerBillingRoutes(app, dependencies.billing, dependencies.auth);
  await registerSubscriptionRoutes(app, dependencies.subscriptions, dependencies.auth);
  await registerBusinessRoutes(app, dependencies.business, dependencies.auth);
  await registerAgentRoutes(app, dependencies.agents);
  await registerAiGatewayRoutes(app, dependencies.aiGateway);
  await registerChatRoutes(app, dependencies.chat, dependencies.auth);
  await registerMailingRoutes(app, dependencies.mailings, dependencies.auth);

  return app;
}
