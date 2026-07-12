import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import type { AuthService } from "../auth/auth.service.js";
import type { AbuseGuardService } from "../security/abuse-guard.js";
import type { GenerationService } from "./generation.service.js";

const createJobSchema = z.object({
  userId: z.string().optional(),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  agentId: z.string().optional(),
  modality: z.enum(["image", "video", "avatar_video", "music", "voice"]).optional(),
  prompt: z.string().trim().min(1),
  avatarVideo: z
    .object({
      referenceImage: z
        .object({
          dataBase64: z.string().min(100).max(4_000_000),
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          filename: z.string().trim().max(120).optional(),
        })
        .optional(),
      script: z.string().trim().min(1).max(4_000).optional(),
      avatarName: z.string().trim().max(80).optional(),
      consentConfirmed: z.boolean().optional(),
      voiceId: z.string().trim().max(120).optional(),
      aspectRatio: z.enum(["auto", "16:9", "9:16", "4:5", "5:4", "1:1"]).optional(),
      expressiveness: z.enum(["low", "medium", "high"]).optional(),
      motionPrompt: z.string().trim().max(500).optional(),
    })
    .optional(),
});

const jobParamsSchema = z.object({
  jobId: z.string().min(1),
});

export async function registerGenerationRoutes(
  app: FastifyInstance,
  generation: GenerationService,
  auth: AuthService,
  abuseGuard: AbuseGuardService
) {
  app.get("/generation/jobs", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await generation.listJobs(user.value.userId));
  });

  app.post("/generation/jobs", async (request, reply) => {
    const input = createJobSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Prompt is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertExpensiveActionAllowed(request, user.value.userId, "generation");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await generation.createJob({ ...input.data, userId: user.value.userId }));
  });

  app.get("/generation/jobs/:jobId", async (request, reply) => {
    const params = jobParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Generation job id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await generation.getJob({ userId: user.value.userId, jobId: params.data.jobId }));
  });

  app.post("/generation/jobs/:jobId/refresh", async (request, reply) => {
    const params = jobParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Generation job id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const allowed = await abuseGuard.assertExpensiveActionAllowed(request, user.value.userId, "generation.refresh");
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await generation.refreshJob({ userId: user.value.userId, jobId: params.data.jobId }));
  });

  app.post("/generation/jobs/:jobId/cancel", async (request, reply) => {
    const params = jobParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Generation job id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await generation.cancelJob({ userId: user.value.userId, jobId: params.data.jobId }));
  });

  app.get("/generation/jobs/:jobId/artifact", async (request, reply) => {
    const params = jobParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Generation job id is required.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    const artifact = await generation.getArtifact({ userId: user.value.userId, jobId: params.data.jobId });
    if (!artifact.ok) return sendResult(reply, artifact);

    return reply
      .header("Content-Type", artifact.value.mimeType)
      .header("Cache-Control", "private, max-age=300")
      .send(artifact.value.data);
  });

  app.get("/generation/assets", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth);
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await generation.listAssets(user.value.userId));
  });
}
