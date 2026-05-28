import type { CountryCode, Language } from "@nerix/shared";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AiGatewayService } from "../ai-gateway/ai-gateway.service.js";
import type { ConversationRepository } from "./conversation.repository.js";

export class ChatService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly aiGateway: AiGatewayService
  ) {}

  async sendMessage(input: {
    userId: string;
    country?: CountryCode;
    language?: Language;
    conversationId?: string;
    message: string;
    agentId?: string;
  }) {
    const message = input.message.trim();

    if (!message) {
      return fail(new DomainError("validation_failed", "Message is required.", 400));
    }

    const routeResult = await this.aiGateway.route({
      userId: input.userId,
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      agentId: input.agentId,
      prompt: message,
    });
    if (!routeResult.ok) return routeResult;

    const conversation =
      input.conversationId
        ? await this.conversations.findById(input.conversationId)
        : await this.conversations.create({
            userId: input.userId,
            agentId: routeResult.value.agentId,
            title: createConversationTitle(message),
          });

    if (!conversation) {
      return fail(new DomainError("not_found", "Conversation was not found.", 404));
    }

    const userMessage = await this.conversations.appendMessage(conversation.id, {
      role: "user",
      content: message,
      metadata: {
        requestedAgentId: input.agentId,
      },
    });

    const assistantMessage = await this.conversations.appendMessage(conversation.id, {
      role: "assistant",
      content:
        "Это локальный mock-ответ Nerix. Архитектура уже выбирает агента, провайдера, модель и считает примерный расход Nerix-токенов.",
      metadata: {
        route: routeResult.value,
      },
    });

    return ok({
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
      route: routeResult.value,
      usage: {
        estimatedCredits: routeResult.value.estimatedCredits,
        reserveCredits: routeResult.value.reserveCredits,
        finalCredits: null,
      },
    });
  }
}

function createConversationTitle(message: string) {
  const title = message.replace(/\s+/g, " ").trim();
  return title.length > 48 ? `${title.slice(0, 45)}...` : title;
}
