import Fastify, { type FastifyBaseLogger, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { config } from "../config.js";
import { registerHealthRoutes } from "./health.routes.js";
import { registerGeoRoutes } from "./geo.routes.js";
import { createDependencies, type AppDependencies } from "./dependencies.js";
import { registerAdminRoutes } from "../modules/admin/routes.js";
import { registerAgentRoutes } from "../modules/agents/routes.js";
import { registerAiGatewayRoutes } from "../modules/ai-gateway/routes.js";
import { registerAuthRoutes } from "../modules/auth/routes.js";
import { registerBillingRoutes } from "../modules/billing/routes.js";
import { registerBusinessOpsRoutes } from "../modules/business-ops/routes.js";
import { registerBusinessRoutes } from "../modules/business/routes.js";
import { registerBusinessWebsiteRoutes } from "../modules/business-websites/routes.js";
import { registerBusinessJobRoutes } from "../modules/business-jobs/routes.js";
import { registerChatRoutes } from "../modules/chat/routes.js";
import { registerGenerationRoutes } from "../modules/generation/routes.js";
import { registerKnowledgeBaseRoutes } from "../modules/knowledge-base/routes.js";
import { registerMailingRoutes } from "../modules/mailings/routes.js";
import { registerNotificationRoutes } from "../modules/notifications/routes.js";
import { registerProjectRoutes } from "../modules/projects/routes.js";
import { registerSupportRoutes } from "../modules/support/routes.js";
import { registerSubscriptionRoutes } from "../modules/subscriptions/routes.js";
import { registerTelegramBotRoutes } from "../modules/telegram-bots/routes.js";
import { registerUserRoutes } from "../modules/users/routes.js";
import { registerWorkspaceFeatureRoutes } from "../modules/workspace-features/routes.js";

export type CreateAppOptions = {
  logger?: boolean | FastifyBaseLogger;
  dependencies?: AppDependencies;
};

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: config.API_BODY_LIMIT_BYTES,
  });
  const dependencies = options.dependencies ?? createDependencies();
  const allowedOrigins = new Set(config.CORS_ORIGINS);
  const allowAnyOrigin = allowedOrigins.has("*");

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowAnyOrigin || allowedOrigins.has(origin) || isLocalDevelopmentOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", resolveRequestId(request));
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  app.addHook("preSerialization", async (_request, reply, payload) => {
    if (!isErrorPayload(payload)) return payload;

    return {
      error: {
        ...payload.error,
        requestId: payload.error.requestId ?? readReplyRequestId(reply),
      },
    };
  });

  await registerHealthRoutes(app, dependencies.database);
  await registerGeoRoutes(app);
  await registerAuthRoutes(app, dependencies.auth, dependencies.abuseGuard);
  await registerUserRoutes(app, dependencies.users, dependencies.auth);
  await registerAdminRoutes(app, dependencies.admin, dependencies.auth);
  await registerBillingRoutes(app, dependencies.billing, dependencies.auth);
  await registerSubscriptionRoutes(app, dependencies.subscriptions, dependencies.auth);
  await registerBusinessRoutes(app, dependencies.business, dependencies.auth);
  await registerBusinessOpsRoutes(app, dependencies.businessOps, dependencies.auth);
  await registerKnowledgeBaseRoutes(app, dependencies.knowledgeBase, dependencies.auth);
  await registerBusinessJobRoutes(app, dependencies.businessJobs, dependencies.auth);
  await registerBusinessWebsiteRoutes(
    app,
    dependencies.businessWebsites,
    dependencies.businessJobs,
    dependencies.auth,
    dependencies.abuseGuard
  );
  await registerTelegramBotRoutes(
    app,
    dependencies.telegramBots,
    dependencies.businessJobs,
    dependencies.auth,
    dependencies.abuseGuard
  );
  await registerAgentRoutes(app, dependencies.agents);
  await registerAiGatewayRoutes(app, dependencies.aiGateway, dependencies.abuseGuard);
  await registerChatRoutes(app, dependencies.chat, dependencies.auth, dependencies.abuseGuard);
  await registerGenerationRoutes(app, dependencies.generation, dependencies.auth, dependencies.abuseGuard);
  await registerMailingRoutes(app, dependencies.mailings, dependencies.auth, dependencies.abuseGuard);
  await registerProjectRoutes(app, dependencies.projects, dependencies.auth);
  await registerSupportRoutes(app, dependencies.support, dependencies.auth, dependencies.abuseGuard);
  await registerWorkspaceFeatureRoutes(app, dependencies.auth, dependencies.users);
  await registerNotificationRoutes(app, dependencies.lifecycleNotifications);

  return app;
}

function resolveRequestId(request: FastifyRequest) {
  const header = request.headers["x-request-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return isSafeRequestId(value) ? value : request.id;
}

function isSafeRequestId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function readReplyRequestId(reply: FastifyReply) {
  const header = reply.getHeader("X-Request-Id");
  return typeof header === "string" ? header : undefined;
}

function isErrorPayload(payload: unknown): payload is { error: { code: string; message: string; requestId?: string } } {
  if (!payload || typeof payload !== "object") return false;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; message?: unknown };
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

function isLocalDevelopmentOrigin(origin: string) {
  if (config.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
