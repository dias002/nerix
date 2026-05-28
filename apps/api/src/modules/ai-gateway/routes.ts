import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import { ok } from "../../domain/result.js";
import type { AiGatewayService } from "./ai-gateway.service.js";
import { getConfiguredProviders, getProviderPolicyMode } from "./provider-registry.js";

const routeSchema = z.object({
  userId: z.string().default("local-user"),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  agentId: z.string().optional(),
  modality: z.enum(["text", "code", "image", "video", "music", "voice", "file"]).optional(),
  prompt: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
});

export async function registerAiGatewayRoutes(app: FastifyInstance, aiGateway: AiGatewayService) {
  app.get("/ai/providers", async (_request, reply) => {
    return sendResult(
      reply,
      ok({
        policyMode: getProviderPolicyMode(),
        providers: getConfiguredProviders().map(({ code, name, enabled, modalities, reason }) => ({
          code,
          name,
          enabled,
          modalities,
          reason,
        })),
      })
    );
  });

  app.post("/ai/route", async (request, reply) => {
    const input = routeSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Prompt is required.",
        },
      });
    }

    return sendResult(reply, await aiGateway.route(input.data));
  });
}
