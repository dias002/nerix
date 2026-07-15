import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import { ok } from "../../domain/result.js";
import type { AbuseGuardService } from "../security/abuse-guard.js";
import type { AiGatewayService } from "./ai-gateway.service.js";
import { getConfiguredProviders, getProviderPolicyMode, getSelectableModels } from "./provider-registry.js";

const routeSchema = z.object({
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  agentId: z.string().optional(),
  taskType: z
    .enum([
      "chat_reply",
      "customer_support",
      "deal_summary",
      "website_copy",
      "campaign_copy",
      "bot_policy",
      "knowledge_search",
      "internal_analysis",
      "code_generation",
      "media_generation",
    ])
    .optional(),
  modality: z.enum(["text", "code", "image", "video", "avatar_video", "music", "voice", "file"]).optional(),
  prompt: z.string().min(1),
  selectedModelId: z.string().trim().min(1).max(160).optional(),
  attachmentIds: z.array(z.string()).optional(),
});

export async function registerAiGatewayRoutes(
  app: FastifyInstance,
  aiGateway: AiGatewayService,
  abuseGuard: AbuseGuardService
) {
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
        models: getSelectableModels().map(({ id, providerCode, providerName, label, description, tier, minPlanId, minPlanName, modalities }) => ({
          id,
          providerCode,
          providerName,
          label,
          description,
          tier,
          minPlanId,
          minPlanName,
          modalities,
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

    const allowed = await abuseGuard.assertPublicAiRouteAllowed(request);
    if (!allowed.ok) return sendResult(reply, allowed);

    return sendResult(reply, await aiGateway.route(input.data));
  });
}
