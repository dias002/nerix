import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveRequestUserId } from "../../server/auth-context.js";
import { sendResult } from "../../server/response.js";
import type { AuthService } from "../auth/auth.service.js";
import type { TelegramBotOrderService } from "./telegram-bot.service.js";

const orderSchema = z.object({
  userId: z.string().optional(),
  country: z.enum(["KZ", "RU"]).default("KZ"),
  companyName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().max(120).optional(),
  contact: z.string().trim().min(3).max(180),
  businessDescription: z.string().trim().min(10).max(2_000),
  services: z.string().trim().min(10).max(4_000),
  audience: z.string().trim().max(1_200).optional(),
  botPurpose: z.string().trim().min(10).max(2_000),
  tone: z.enum(["friendly", "expert", "sales", "strict"]).default("friendly"),
  responseRules: z.string().trim().min(10).max(4_000),
  escalationContact: z.string().trim().min(3).max(300),
  faq: z.string().trim().max(8_000).optional(),
  sourceLinks: z.string().trim().max(2_000).optional(),
  botUsername: z.string().trim().max(80).optional(),
  botToken: z.string().trim().max(220).optional(),
});

const miniAppDraftSchema = z.object({
  country: z.enum(["KZ", "RU"]).default("KZ"),
  companyName: z.string().trim().min(2).max(120),
  businessCategory: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).optional(),
  contact: z.string().trim().min(3).max(180),
  website: z.string().trim().max(300).optional(),
  mainOffer: z.string().trim().min(10).max(2_000),
  priceInfo: z.string().trim().max(1_500).optional(),
  audience: z.string().trim().max(1_000).optional(),
  goals: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  language: z.enum(["ru", "kk", "en"]).default("ru"),
  telegramInitData: z.string().max(8_000).optional(),
});

export async function registerTelegramBotRoutes(
  app: FastifyInstance,
  telegramBots: TelegramBotOrderService,
  auth: AuthService
) {
  app.get("/telegram-bots/product", async (_request, reply) => sendResult(reply, telegramBots.getProduct()));

  app.post("/telegram-bots/miniapp/draft", async (request, reply) => {
    const input = miniAppDraftSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid Telegram Mini App draft payload.",
        },
      });
    }

    return sendResult(reply, telegramBots.createMiniAppDraft(input.data));
  });

  app.get("/telegram-bots/orders", async (request, reply) => {
    const user = await resolveRequestUserId(request, auth, "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await telegramBots.listOrders(user.value.userId));
  });

  app.post("/telegram-bots/orders", async (request, reply) => {
    const input = orderSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).send({
        error: {
          code: "validation_failed",
          message: "Invalid Telegram bot order payload.",
        },
      });
    }

    const user = await resolveRequestUserId(request, auth, input.data.userId ?? "local-user");
    if (!user.ok) return sendResult(reply, user);

    return sendResult(reply, await telegramBots.createOrder({ ...input.data, userId: user.value.userId }));
  });
}
