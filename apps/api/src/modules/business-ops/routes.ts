import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { BusinessOpsService } from "./business-ops.service.js";

const userQuerySchema = z.object({
  userId: z.string().optional(),
});

const messageRoleSchema = z.enum(["customer", "bot", "employee", "system"]);
const channelSchema = z.enum(["telegram", "website", "manual"]);
const ratingSchema = z.enum(["bad", "good", "excellent"]);

const customerMessageSchema = z.object({
  role: messageRoleSchema,
  authorName: z.string().trim().max(120).optional(),
  content: z.string().trim().min(1).max(4_000),
});

const createConversationSchema = z.object({
  userId: z.string().optional(),
  channel: channelSchema.default("manual"),
  customerName: z.string().trim().max(120).optional(),
  customerContact: z.string().trim().max(180).optional(),
  source: z.string().trim().max(180).optional(),
  trainingAllowed: z.boolean().default(false),
  messages: z.array(customerMessageSchema).min(1).max(40),
});

const addCustomerMessageSchema = z.object({
  userId: z.string().optional(),
  role: messageRoleSchema,
  authorName: z.string().trim().max(120).optional(),
  content: z.string().trim().min(1).max(4_000),
});

const rateConversationSchema = z.object({
  userId: z.string().optional(),
  rating: ratingSchema,
});

const teamMessageSchema = z.object({
  userId: z.string().optional(),
  memberId: z.string().trim().min(1).max(120).nullable().optional(),
  authorName: z.string().trim().min(1).max(120),
  roleTitle: z.string().trim().max(120).optional(),
  text: z.string().trim().min(1).max(2_000),
});

export async function registerBusinessOpsRoutes(
  app: FastifyInstance,
  businessOps: BusinessOpsService,
  auth: AuthService
) {
  app.get("/business/ops", async (request, reply) => {
    const input = userQuerySchema.safeParse(request.query);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business operations query.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await businessOps.getOverview(user.value.userId));
  });

  app.post("/business/ops/conversations", async (request, reply) => {
    const input = createConversationSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business conversation payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await businessOps.createConversation(user.value.userId, input.data));
  });

  app.post("/business/ops/conversations/:conversationId/messages", async (request, reply) => {
    const params = z.object({ conversationId: z.string().min(1) }).safeParse(request.params);
    const input = addCustomerMessageSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business conversation message payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(
      reply,
      await businessOps.addCustomerMessage(user.value.userId, params.data.conversationId, input.data)
    );
  });

  app.patch("/business/ops/conversations/:conversationId/rating", async (request, reply) => {
    const params = z.object({ conversationId: z.string().min(1) }).safeParse(request.params);
    const input = rateConversationSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business conversation rating payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(
      reply,
      await businessOps.rateConversation(user.value.userId, params.data.conversationId, input.data.rating)
    );
  });

  app.post("/business/ops/team/messages", async (request, reply) => {
    const input = teamMessageSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business team message payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await businessOps.addTeamMessage(user.value.userId, input.data));
  });
}
