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

const featureFlagParamsSchema = z.object({
  key: z.string().trim().min(1).max(120),
});

const featureFlagUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  label: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1_000).optional(),
  audience: z.string().trim().min(1).max(120).optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
});

const aiProviderParamsSchema = z.object({
  code: z.string().trim().min(1).max(80),
});

const aiProviderUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.string().trim().min(1).max(160).optional(),
  trafficMode: z.enum(["primary", "reserve", "paused"]).optional(),
});

const agentParamsSchema = z.object({
  id: z.string().trim().min(1).max(80),
});

const agentUpdateSchema = z.object({
  enabled: z.boolean().optional(),
});

const promotionParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const promotionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  body: z.string().trim().max(2_000).optional(),
  placement: z.string().trim().min(1).max(120).optional(),
  audience: z.string().trim().min(1).max(120).optional(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
});

const contentBlockParamsSchema = z.object({
  key: z.string().trim().min(1).max(120),
});

const contentBlockUpdateSchema = z.object({
  locale: z.string().trim().min(2).max(12).optional(),
  title: z.string().trim().max(180).optional(),
  body: z.string().trim().max(5_000).optional(),
  placement: z.string().trim().min(1).max(120).optional(),
  active: z.boolean().optional(),
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

  app.get("/admin/control", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    return sendResult(reply, await admin.controlState());
  });

  app.patch("/admin/control/feature-flags/:key", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const params = featureFlagParamsSchema.safeParse(request.params);
    const input = featureFlagUpdateSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid feature flag payload.",
        },
      });
    }

    return sendResult(
      reply,
      await admin.updateFeatureFlag({
        key: params.data.key,
        ...input.data,
        actorUserId: currentUser.value.actorUserId,
      })
    );
  });

  app.patch("/admin/control/ai-providers/:code", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const params = aiProviderParamsSchema.safeParse(request.params);
    const input = aiProviderUpdateSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid AI provider payload.",
        },
      });
    }

    return sendResult(
      reply,
      await admin.updateAiProvider({
        code: params.data.code,
        ...input.data,
        actorUserId: currentUser.value.actorUserId,
      })
    );
  });

  app.patch("/admin/control/agents/:id", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const params = agentParamsSchema.safeParse(request.params);
    const input = agentUpdateSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid agent payload.",
        },
      });
    }

    return sendResult(
      reply,
      await admin.updateAgent({
        id: params.data.id,
        ...input.data,
        actorUserId: currentUser.value.actorUserId,
      })
    );
  });

  app.patch("/admin/control/promotions/:slug", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const params = promotionParamsSchema.safeParse(request.params);
    const input = promotionUpdateSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid promotion payload.",
        },
      });
    }

    return sendResult(
      reply,
      await admin.updatePromotion({
        slug: params.data.slug,
        ...input.data,
        actorUserId: currentUser.value.actorUserId,
      })
    );
  });

  app.patch("/admin/control/content-blocks/:key", async (request, reply) => {
    const currentUser = await resolveAdmin(request, auth);
    if (!currentUser.ok) return sendResult(reply, currentUser);

    const params = contentBlockParamsSchema.safeParse(request.params);
    const input = contentBlockUpdateSchema.safeParse(request.body);
    if (!params.success || !input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid content block payload.",
        },
      });
    }

    return sendResult(
      reply,
      await admin.updateContentBlock({
        key: params.data.key,
        ...input.data,
        actorUserId: currentUser.value.actorUserId,
      })
    );
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
        actorUserId: null,
      },
    };
  }

  const accessToken = readBearerToken(request.headers.authorization);
  const currentUser = await auth.me(accessToken);
  if (!currentUser.ok) return currentUser;

  if (!currentUser.value.user.permissions.adminPanel) {
    return fail(new DomainError("unauthorized", "Admin panel is available only for admin users.", 403));
  }

  return {
    ok: true as const,
    value: {
      source: "auth",
      actorUserId: currentUser.value.user.id,
      user: currentUser.value.user,
    },
  };
}
