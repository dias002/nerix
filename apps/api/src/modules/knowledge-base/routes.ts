import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import { ensureBusinessPermission } from "../business/business-permissions.js";
import type { KnowledgeBaseService } from "./knowledge-base.service.js";

const entryTypeSchema = z.enum(["company_profile", "service", "faq", "policy", "brand_voice", "source_note"]);

const createEntrySchema = z.object({
  type: entryTypeSchema,
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().min(1).max(10_000),
  sourceUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

const updateEntrySchema = z.object({
  type: entryTypeSchema.optional(),
  title: z.string().trim().min(1).max(180).optional(),
  content: z.string().trim().min(1).max(10_000).optional(),
  sourceUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

export async function registerKnowledgeBaseRoutes(
  app: FastifyInstance,
  knowledgeBase: KnowledgeBaseService,
  auth: AuthService
) {
  app.get("/business/knowledge-base", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await knowledgeBase.listEntries(user.value.userId));
  });

  app.post("/business/knowledge-base", async (request, reply) => {
    const input = createEntrySchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid knowledge base entry payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await knowledgeBase.createEntry(user.value.userId, input.data));
  });

  app.patch("/business/knowledge-base/:entryId", async (request, reply) => {
    const params = z.object({ entryId: z.string().min(1) }).safeParse(request.params);
    const input = updateEntrySchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid knowledge base update payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await knowledgeBase.updateEntry(user.value.userId, params.data.entryId, input.data));
  });

  app.delete("/business/knowledge-base/:entryId", async (request, reply) => {
    const params = z.object({ entryId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Knowledge base entry id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureBusinessPermission(request, auth, "businessSettings");
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await knowledgeBase.deleteEntry(user.value.userId, params.data.entryId));
  });
}
