import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DomainError, fail, ok, type Result } from "../../domain/result.js";
import { readBearerToken, resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { BusinessService } from "./business.service.js";

const businessRoleKeySchema = z.enum(["owner", "sales", "support", "marketing", "developer"]);
const businessMemberStatusSchema = z.enum(["online", "away", "offline"]);
const businessIdeaStatusSchema = z.enum(["suggested", "planned", "in_progress", "done"]);

const workspaceQuerySchema = z.object({
  userId: z.string().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  roleKey: businessRoleKeySchema,
  invitedEmail: z.string().trim().email().optional(),
  roleTitle: z.string().trim().min(1).max(80).optional(),
  access: z.string().trim().min(1).max(160).optional(),
  status: businessMemberStatusSchema.optional(),
});

const addDealNoteSchema = z.object({
  userId: z.string().optional(),
  text: z.string().trim().min(1).max(1_000),
});

const updateIdeaStatusSchema = z.object({
  userId: z.string().optional(),
  status: businessIdeaStatusSchema,
});

export async function registerBusinessRoutes(app: FastifyInstance, business: BusinessService, auth: AuthService) {
  app.get("/business/workspace", async (request, reply) => {
    const input = workspaceQuerySchema.safeParse(request.query);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business workspace query.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await business.getWorkspace(user.value.userId));
  });

  app.post("/business/members", async (request, reply) => {
    const input = addMemberSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business member payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    const permission = await ensureCanManageBusinessMembers(request.headers.authorization, auth);
    if (!permission.ok) return sendResult(reply, permission);

    return sendResult(reply, await business.addMember(user.value.userId, input.data));
  });

  app.post("/business/deals/:dealId/notes", async (request, reply) => {
    const params = z.object({ dealId: z.string().min(1) }).safeParse(request.params);
    const input = addDealNoteSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business deal note payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await business.addDealNote(user.value.userId, params.data.dealId, input.data.text));
  });

  app.patch("/business/ideas/:ideaId", async (request, reply) => {
    const params = z.object({ ideaId: z.string().min(1) }).safeParse(request.params);
    const input = updateIdeaStatusSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid business idea payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await business.updateIdeaStatus(user.value.userId, params.data.ideaId, input.data.status));
  });
}

async function ensureCanManageBusinessMembers(
  authorization: string | undefined,
  auth: AuthService
): Promise<Result<null>> {
  const accessToken = readBearerToken(authorization);
  if (!accessToken) return ok(null);

  const currentUser = await auth.me(accessToken);
  if (!currentUser.ok) return fail(currentUser.error);

  if (!currentUser.value.user.permissions.businessSettings) {
    return fail(new DomainError("unauthorized", "Only the Business owner can invite employees.", 403));
  }

  return ok(null);
}
