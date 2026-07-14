import type { FastifyInstance } from "fastify";
import { config } from "../../config.js";
import { DomainError, fail } from "../../domain/result.js";
import { readBearerToken } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { LifecycleNotificationsService } from "./lifecycle-notifications.service.js";

export async function registerNotificationRoutes(app: FastifyInstance, lifecycleNotifications: LifecycleNotificationsService) {
  app.post("/notifications/lifecycle/run", async (request, reply) => {
    if (!isLifecycleTokenAllowed(request.headers.authorization, request.headers["x-nomduchat-cron-token"])) {
      return sendResult(
        reply,
        fail(new DomainError("unauthorized", "Lifecycle notification token is required.", 401))
      );
    }

    return sendResult(reply, await lifecycleNotifications.run());
  });
}

function isLifecycleTokenAllowed(authorization: string | undefined, headerToken: string | string[] | undefined) {
  const configuredToken = config.LIFECYCLE_NOTIFICATIONS_TOKEN;
  if (!configuredToken) return config.NODE_ENV !== "production";

  const token = readBearerToken(authorization) ?? readHeaderToken(headerToken);
  return token === configuredToken;
}

function readHeaderToken(headerToken: string | string[] | undefined) {
  return Array.isArray(headerToken) ? headerToken[0] : headerToken ?? null;
}
