import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../../config.js";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { SubscriptionService } from "./subscription.service.js";

const countryQuerySchema = z.object({
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .default("KZ"),
});

const checkoutSchema = z.object({
  userId: z.string().optional(),
  planId: z.string().min(1),
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .default("KZ"),
});

const completeSchema = z.object({
  checkoutId: z.string().min(1),
});

const userSchema = z.object({
  userId: z.string().optional(),
});

const yooKassaWebhookSchema = z.object({
  event: z.string(),
  object: z.object({
    id: z.string().min(1),
    status: z.string().optional(),
  }),
});

const kaspiWebhookSchema = z
  .object({
    providerCheckoutId: z.string().min(1).optional(),
    paymentId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    event: z.string().min(1).optional(),
  })
  .passthrough();

export async function registerSubscriptionRoutes(
  app: FastifyInstance,
  subscriptions: SubscriptionService,
  auth: AuthService
) {
  app.get("/plans", async (request, reply) => {
    const input = countryQuerySchema.safeParse(request.query);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Country is required.",
        },
      });
    }

    return sendResult(reply, await subscriptions.listPlans(input.data.country as "KZ" | "RU"));
  });

  app.post("/subscriptions/checkout", async (request, reply) => {
    const input = checkoutSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Plan and country are required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await subscriptions.createCheckout({ ...input.data, userId: user.value.userId }));
  });

  app.post("/subscriptions/mock/complete", async (request, reply) => {
    const input = completeSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Checkout id is required.",
        },
      });
    }

    return sendResult(reply, await subscriptions.completeMockCheckout(input.data));
  });

  app.get("/subscriptions/current", async (request, reply) => {
    const input = userSchema.safeParse(request.query);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "User id is invalid.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await subscriptions.currentSubscription(user.value.userId));
  });

  app.post("/subscriptions/cancel", async (request, reply) => {
    const input = userSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "User id is invalid.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await subscriptions.cancelCurrentSubscription(user.value.userId));
  });

  app.post("/subscriptions/webhooks/yookassa", async (request, reply) => {
    if (!verifyWebhookSecret(request.headers["x-nomduchat-webhook-secret"])) {
      return reply.status(401).send({
        error: {
          code: "unauthorized",
          message: "Webhook secret is invalid.",
        },
      });
    }

    const input = yooKassaWebhookSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "YooKassa webhook payload is invalid.",
        },
      });
    }

    return sendResult<unknown>(
      reply,
      await subscriptions.processProviderPaymentEvent({
        provider: "yookassa",
        providerCheckoutId: input.data.object.id,
        paymentStatus: yooKassaPaymentStatus(input.data.event, input.data.object.status),
        eventType: input.data.event,
        idempotencyKey: `yookassa:${input.data.event}:${input.data.object.id}`,
        payload: asWebhookPayload(input.data),
      })
    );
  });

  app.post("/subscriptions/webhooks/kaspi", async (request, reply) => {
    if (!verifyWebhookSecret(request.headers["x-nomduchat-webhook-secret"])) {
      return reply.status(401).send({
        error: {
          code: "unauthorized",
          message: "Webhook secret is invalid.",
        },
      });
    }

    const input = kaspiWebhookSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Kaspi webhook payload is invalid.",
        },
      });
    }

    const providerCheckoutId = input.data.providerCheckoutId ?? input.data.paymentId ?? input.data.orderId ?? input.data.id;
    if (!providerCheckoutId) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Kaspi webhook requires providerCheckoutId, paymentId, orderId, or id.",
        },
      });
    }

    const eventType = input.data.event ?? `kaspi.payment.${input.data.status ?? "unknown"}`;
    return sendResult<unknown>(
      reply,
      await subscriptions.processProviderPaymentEvent({
        provider: "kaspi",
        providerCheckoutId,
        paymentStatus: kaspiPaymentStatus(input.data.status ?? input.data.event),
        eventType,
        idempotencyKey: `kaspi:${eventType}:${providerCheckoutId}`,
        payload: asWebhookPayload(input.data),
      })
    );
  });
}

function verifyWebhookSecret(header: string | string[] | undefined) {
  if (!config.PAYMENT_WEBHOOK_SECRET) return true;
  const value = Array.isArray(header) ? header[0] : header;
  return value === config.PAYMENT_WEBHOOK_SECRET;
}

function yooKassaPaymentStatus(event: string, status?: string) {
  if (event === "payment.succeeded" || status === "succeeded") return "succeeded";
  if (event === "payment.canceled" || status === "canceled") return "cancelled";
  return "ignored";
}

function kaspiPaymentStatus(statusOrEvent?: string) {
  const value = statusOrEvent?.toLowerCase() ?? "";
  if (["paid", "success", "succeeded", "completed", "approved"].includes(value)) return "succeeded";
  if (["cancel", "cancelled", "canceled", "rejected"].includes(value)) return "cancelled";
  if (["failed", "error", "declined"].includes(value)) return "failed";
  return "ignored";
}

function asWebhookPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
