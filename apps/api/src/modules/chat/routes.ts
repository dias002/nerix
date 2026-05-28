import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendResult } from "../../server/response.js";
import { countrySchema, languageSchema } from "../../server/schemas.js";
import type { ChatService } from "./chat.service.js";

const sendMessageSchema = z.object({
  userId: z.string().default("local-user"),
  country: countrySchema.default("KZ"),
  language: languageSchema.default("ru"),
  conversationId: z.string().optional(),
  message: z.string().min(1),
  agentId: z.string().optional(),
});

export async function registerChatRoutes(app: FastifyInstance, chat: ChatService) {
  app.post("/chat/messages", async (request, reply) => {
    const input = sendMessageSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Message is required.",
        },
      });
    }

    return sendResult(reply, await chat.sendMessage(input.data));
  });
}
