import type { FastifyInstance } from "fastify";
import type { OutgoingHttpHeaders } from "node:http";
import { z } from "zod";
import type { Result } from "../../domain/result.js";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AbuseGuardService } from "../security/abuse-guard.js";
import type { ChatService } from "./chat.service.js";

const sendMessageSchema = z.object({
  userId: z.string().optional(),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  conversationId: z.string().optional(),
  message: z.string().min(1),
  agentId: z.string().optional(),
  selectedModelId: z.string().trim().min(1).max(160).optional(),
  responseStyle: z.enum(["auto", "business", "business_visual", "conversational", "brief", "detailed"]).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(180),
        type: z.string().trim().max(120).optional().default("application/octet-stream"),
        size: z.number().int().nonnegative().max(8_000_000),
        content: z.string().max(20_000).optional(),
        truncated: z.boolean().optional(),
      })
    )
    .max(5)
    .optional(),
});

const regenerateMessageSchema = z.object({
  userId: z.string().optional(),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  conversationId: z.string().min(1),
  agentId: z.string().optional(),
  selectedModelId: z.string().trim().min(1).max(160).optional(),
  responseStyle: z.enum(["auto", "business", "business_visual", "conversational", "brief", "detailed"]).optional(),
});

const selectAnswerSchema = z.object({
  userId: z.string().optional(),
  conversationId: z.string().min(1),
});

const feedbackSchema = z.object({
  userId: z.string().optional(),
  conversationId: z.string().min(1),
  rating: z.enum(["up", "down", "best", "bad", "needs_fix"]).default("up"),
  selectedAsBest: z.boolean().optional().default(false),
  reasonTags: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  comment: z.string().trim().max(1_000).optional(),
});

const conversationParamsSchema = z.object({
  conversationId: z.string().min(1),
});

export async function registerChatRoutes(
  app: FastifyInstance,
  chat: ChatService,
  auth: AuthService,
  abuseGuard: AbuseGuardService
) {
  app.get("/usage/limits", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await chat.getUsageLimits(user.value.userId, { isAdmin: user.value.isAdmin }));
  });

  app.get("/chat/conversations", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await chat.listConversations(user.value.userId));
  });

  app.get("/chat/conversations/:conversationId", async (request, reply) => {
    const params = conversationParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Conversation id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(
      reply,
      await chat.getConversation({
        userId: user.value.userId,
        conversationId: params.data.conversationId,
      })
    );
  });

  app.get("/memory/items", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await chat.listMemoryItems(user.value.userId));
  });

  app.post("/chat/messages", async (request, reply) => {
    const input = sendMessageSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Message is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    const allowed = await assertFreeUserAiRequestAllowed(request, chat, abuseGuard, user.value.userId, user.value.isAdmin);
    if (!allowed.ok) return sendResult(reply, allowed);

    const result = await chat.sendMessage({ ...input.data, userId: user.value.userId, isAdmin: user.value.isAdmin });
    return sendResult(reply, result as Result<unknown>);
  });

  app.post("/chat/messages/stream", async (request, reply) => {
    const input = sendMessageSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Message is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    const allowed = await assertFreeUserAiRequestAllowed(request, chat, abuseGuard, user.value.userId, user.value.isAdmin);
    if (!allowed.ok) return sendResult(reply, allowed);

    const inheritedHeaders: OutgoingHttpHeaders = {};
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) inheritedHeaders[name] = value;
    }

    reply.raw.writeHead(200, {
      ...inheritedHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.flushHeaders?.();

    let closed = false;
    request.raw.on("close", () => {
      closed = true;
    });

    const writeEvent = (event: string, data: unknown) => {
      if (closed || reply.raw.destroyed) return;
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await chat.streamMessage(
        { ...input.data, userId: user.value.userId, isAdmin: user.value.isAdmin },
        {
          onStart: (payload) => writeEvent("start", payload),
          onDelta: (delta) => writeEvent("delta", { delta }),
        }
      );

      if (!result.ok) {
        writeEvent("error", {
          code: result.error.code,
          message: result.error.message,
        });
      } else {
        writeEvent("done", result.value);
      }
    } catch (error) {
      writeEvent("error", {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Streaming response failed.",
      });
    } finally {
      if (!closed && !reply.raw.destroyed) reply.raw.end();
    }

    return reply;
  });

  app.post("/chat/messages/regenerate", async (request, reply) => {
    const input = regenerateMessageSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Conversation is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    const allowed = await assertFreeUserAiRequestAllowed(request, chat, abuseGuard, user.value.userId, user.value.isAdmin);
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await chat.regenerateLastAnswer({ ...input.data, userId: user.value.userId, isAdmin: user.value.isAdmin }));
  });

  app.post("/chat/answers/:assistantMessageId/select", async (request, reply) => {
    const params = z.object({ assistantMessageId: z.string().min(1) }).safeParse(request.params);
    const input = selectAnswerSchema.safeParse(request.body);

    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Conversation and assistant answer are required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(
      reply,
      await chat.selectBestAnswer({
        userId: user.value.userId,
        conversationId: input.data.conversationId,
        assistantMessageId: params.data.assistantMessageId,
      })
    );
  });

  app.post("/chat/messages/:messageId/feedback", async (request, reply) => {
    const params = z.object({ messageId: z.string().min(1) }).safeParse(request.params);
    const input = feedbackSchema.safeParse(request.body);

    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Conversation and feedback are required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(
      reply,
      await chat.submitMessageFeedback({
        ...input.data,
        userId: user.value.userId,
        messageId: params.data.messageId,
      })
    );
  });
}

async function assertFreeUserAiRequestAllowed(
  request: Parameters<AbuseGuardService["assertFreeAiRequestAllowed"]>[0],
  chat: ChatService,
  abuseGuard: AbuseGuardService,
  userId: string,
  isAdmin = false
) {
  if (isAdmin) return { ok: true as const, value: { allowed: true } };

  const limits = await chat.getUsageLimits(userId);
  if (!limits.ok || limits.value.hasActiveSubscription) return limits.ok ? { ok: true as const, value: { allowed: true } } : limits;

  return abuseGuard.assertFreeAiRequestAllowed(request, userId);
}
