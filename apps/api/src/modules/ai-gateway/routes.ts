import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendResult } from "../../server/response.js";
import type { AiGatewayService } from "./ai-gateway.service.js";

const routeSchema = z.object({
  userId: z.string().default("local-user"),
  country: z.enum(["KZ", "KG", "UZ", "TJ", "TM", "AM", "AZ", "GE", "MD", "RU", "BY", "OTHER"]).default("KZ"),
  language: z.enum(["ru", "kz", "en"]).default("ru"),
  agentId: z.string().optional(),
  modality: z.enum(["text", "code", "image", "video", "music", "voice", "file"]).optional(),
  prompt: z.string().min(1),
  attachmentIds: z.array(z.string()).optional(),
});

export async function registerAiGatewayRoutes(app: FastifyInstance, aiGateway: AiGatewayService) {
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
