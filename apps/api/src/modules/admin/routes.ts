import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { DomainError, fail } from "../../domain/result.js";
import { readBearerToken, readLocalRoleOverride } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AdminService } from "./admin.service.js";

const updatePriceSchema = z.object({
  planId: z.enum(["base", "ultra", "pro", "business"]),
  country: z.enum(["KZ", "RU"]),
  amountMinor: z.number().int().positive(),
});

const userSearchSchema = z.object({
  q: z.string().max(120).optional(),
});

export async function registerAdminRoutes(app: FastifyInstance, admin: AdminService, auth: AuthService) {
  app.get("/admin/overview", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    return sendResult(reply, await admin.overview());
  });

  app.get("/admin/users", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const input = userSearchSchema.safeParse(request.query);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid user search query.",
        },
      });
    }

    return sendResult(reply, await admin.searchUsers(input.data.q ?? ""));
  });

  app.patch("/admin/pricing", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const input = updatePriceSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid pricing payload.",
        },
      });
    }

    return reply.send({
      pricing: await admin.updatePlanPrice(input.data),
    });
  });
}

async function resolveAdmin(request: FastifyRequest, auth: AuthService) {
  if (readLocalRoleOverride(request) === "admin") {
    return {
      ok: true as const,
      value: {
        source: "local-role",
      },
    };
  }

  const accessToken = readBearerToken(request.headers.authorization);
  const currentUser = await auth.me(accessToken);
  if (!currentUser.ok) return currentUser;

  if (!currentUser.value.user.permissions.adminPanel) {
    return fail(new DomainError("unauthorized", "Admin panel is available only for admin users.", 403));
  }

  return currentUser;
}
