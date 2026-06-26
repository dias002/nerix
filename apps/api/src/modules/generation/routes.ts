import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import type { AuthService } from "../auth/auth.service.js";
import type { GenerationService } from "./generation.service.js";

const createJobSchema = z.object({
  userId: z.string().optional(),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  agentId: z.string().optional(),
  modality: z.enum(["image", "video", "music", "voice"]).optional(),
  prompt: z.string().trim().min(1),
});

const jobParamsSchema = z.object({
  jobId: z.string().min(1),
});

export async function registerGenerationRoutes(app: FastifyInstance, generation: GenerationService, auth: AuthService) {
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

    return sendResult(reply, await generation.refreshJob({ userId: user.value.userId, jobId: params.data.jobId }));
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
