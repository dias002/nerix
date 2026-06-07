import type { CountryCode, Language } from "@nerix/shared";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AiGatewayService } from "../ai-gateway/ai-gateway.service.js";
import type { ConversationRepository } from "./conversation.repository.js";
import type { MessageFeedbackRating } from "./conversation.types.js";

type ChatAttachment = {
  name: string;
  type?: string;
  size: number;
  content?: string;
  truncated?: boolean;
};

export class ChatService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly aiGateway: AiGatewayService
  ) {}

  async listConversations(userId: string) {
    return ok({
      conversations: await this.conversations.listByUser(userId),
    });
  }

  async getConversation(input: { userId: string; conversationId: string }) {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation || conversation.userId !== input.userId) {
      return fail(new DomainError("not_found", "Conversation was not found.", 404));
    }

    return ok({
      conversation,
    });
  }

  async listMemoryItems(userId: string) {
    return ok({
      items: await this.conversations.listMemoryItems(userId),
    });
  }

  async sendMessage(input: {
    userId: string;
    country?: CountryCode;
    language?: Language;
    conversationId?: string;
    message: string;
    agentId?: string;
    attachments?: ChatAttachment[];
  }) {
    const message = input.message.trim();
    const attachments = normalizeAttachments(input.attachments);

    if (!message) {
      return fail(new DomainError("validation_failed", "Message is required.", 400));
    }

    const prompt = buildPrompt(message, attachments);

    const routeResult = await this.aiGateway.route({
      userId: input.userId,
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      agentId: input.agentId,
      prompt,
    });
    if (!routeResult.ok) {
      await this.conversations.recordAiError({
        userId: input.userId,
        stage: "route",
        severity: "error",
        errorCode: routeResult.error.code,
        errorMessage: routeResult.error.message,
        agentId: input.agentId ?? null,
        promptExcerpt: createPromptExcerpt(prompt),
        requestPayload: {
          country: input.country ?? "KZ",
          language: input.language ?? "ru",
          agentId: input.agentId ?? null,
        },
      });
      return routeResult;
    }

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
        attachments,
      },
    });
    if (!userMessage) {
      return fail(new DomainError("internal_error", "User message could not be stored.", 500));
    }

    const completionResult = await this.completeSafely({
      userId: input.userId,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      prompt,
      route: routeResult.value,
    });
    if (!completionResult.ok) return completionResult;

    const assistantMessage = await this.conversations.appendMessage(conversation.id, {
      role: "assistant",
      content: completionResult.value.content,
      metadata: {
        route: routeResult.value,
        providerUsage: completionResult.value.rawUsage,
      },
    });
    if (!assistantMessage) {
      return fail(new DomainError("internal_error", "Assistant message could not be stored.", 500));
    }

    const answerVariant = await this.conversations.recordAnswerVariant({
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      agentId: routeResult.value.agentId,
      provider: routeResult.value.provider,
      model: routeResult.value.model,
      routeMetadata: routeResult.value,
      providerUsage: completionResult.value.rawUsage ?? {},
    });

    return ok({
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
      answerVariant,
      route: routeResult.value,
      usage: {
        estimatedCredits: routeResult.value.estimatedCredits,
        reserveCredits: routeResult.value.reserveCredits,
        finalCredits: null,
      },
    });
  }

  async regenerateLastAnswer(input: {
    userId: string;
    country?: CountryCode;
    language?: Language;
    conversationId: string;
    agentId?: string;
  }) {
    const conversation = await this.conversations.findById(input.conversationId);

    if (!conversation) {
      return fail(new DomainError("not_found", "Conversation was not found.", 404));
    }

    if (conversation.userId !== input.userId) {
      return fail(new DomainError("unauthorized", "Conversation belongs to another user.", 401));
    }

    const userMessage = [...conversation.messages].reverse().find((message) => message.role === "user");
    if (!userMessage) {
      return fail(new DomainError("validation_failed", "Conversation does not have a user message to regenerate.", 400));
    }

    const metadataAgentId =
      typeof userMessage.metadata?.requestedAgentId === "string" ? userMessage.metadata.requestedAgentId : undefined;
    const attachments = normalizeAttachments(readAttachmentsFromMetadata(userMessage.metadata?.attachments));
    const prompt = buildPrompt(userMessage.content, attachments);

    const routeResult = await this.aiGateway.route({
      userId: input.userId,
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      agentId: input.agentId ?? metadataAgentId,
      prompt,
    });
    if (!routeResult.ok) {
      await this.conversations.recordAiError({
        userId: input.userId,
        conversationId: conversation.id,
        messageId: userMessage.id,
        stage: "regenerate_route",
        severity: "error",
        errorCode: routeResult.error.code,
        errorMessage: routeResult.error.message,
        agentId: input.agentId ?? metadataAgentId ?? null,
        promptExcerpt: createPromptExcerpt(prompt),
      });
      return routeResult;
    }

    const completionResult = await this.completeSafely({
      userId: input.userId,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      prompt,
      route: routeResult.value,
      stage: "regenerate_complete",
    });
    if (!completionResult.ok) return completionResult;

    const assistantMessage = await this.conversations.appendMessage(conversation.id, {
      role: "assistant",
      content: completionResult.value.content,
      metadata: {
        regeneratedFromMessageId: userMessage.id,
        route: routeResult.value,
        providerUsage: completionResult.value.rawUsage,
      },
    });
    if (!assistantMessage) {
      return fail(new DomainError("internal_error", "Assistant message could not be stored.", 500));
    }

    const answerVariant = await this.conversations.recordAnswerVariant({
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      agentId: routeResult.value.agentId,
      provider: routeResult.value.provider,
      model: routeResult.value.model,
      routeMetadata: {
        ...routeResult.value,
        regeneratedFromMessageId: userMessage.id,
      },
      providerUsage: completionResult.value.rawUsage ?? {},
    });

    return ok({
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
      answerVariant,
      route: routeResult.value,
      usage: {
        estimatedCredits: routeResult.value.estimatedCredits,
        reserveCredits: routeResult.value.reserveCredits,
        finalCredits: null,
      },
    });
  }

  async selectBestAnswer(input: { userId: string; conversationId: string; assistantMessageId: string }) {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      return fail(new DomainError("not_found", "Conversation was not found.", 404));
    }

    if (conversation.userId !== input.userId) {
      return fail(new DomainError("unauthorized", "Conversation belongs to another user.", 401));
    }

    const assistantMessage = conversation.messages.find(
      (message) => message.id === input.assistantMessageId && message.role === "assistant"
    );
    if (!assistantMessage) {
      return fail(new DomainError("not_found", "Assistant answer was not found.", 404));
    }

    const answerVariant = await this.conversations.selectAnswerVariant(input);
    if (!answerVariant) {
      return fail(new DomainError("not_found", "Answer variant was not found.", 404));
    }

    await this.conversations.addMessageFeedback({
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.assistantMessageId,
      rating: "best",
      selectedAsBest: true,
      reasonTags: ["client_selected"],
    });

    return ok({
      conversationId: input.conversationId,
      assistantMessage,
      answerVariant,
    });
  }

  async submitMessageFeedback(input: {
    userId: string;
    conversationId: string;
    messageId: string;
    rating: MessageFeedbackRating;
    selectedAsBest?: boolean;
    reasonTags?: string[];
    comment?: string | null;
  }) {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      return fail(new DomainError("not_found", "Conversation was not found.", 404));
    }

    if (conversation.userId !== input.userId) {
      return fail(new DomainError("unauthorized", "Conversation belongs to another user.", 401));
    }

    const message = conversation.messages.find((candidate) => candidate.id === input.messageId);
    if (!message) {
      return fail(new DomainError("not_found", "Message was not found.", 404));
    }

    const answerVariant =
      input.selectedAsBest && message.role === "assistant"
        ? await this.conversations.selectAnswerVariant({
            userId: input.userId,
            conversationId: input.conversationId,
            assistantMessageId: input.messageId,
          })
        : null;
    const feedback = await this.conversations.addMessageFeedback(input);
    if (!feedback) {
      return fail(new DomainError("not_found", "Feedback target was not found.", 404));
    }

    return ok({
      feedback,
      answerVariant,
    });
  }

  private async completeSafely(input: {
    userId: string;
    conversationId: string;
    userMessageId: string;
    prompt: string;
    route: {
      agentId: string;
      provider: string;
      model: string;
    };
    stage?: string;
  }) {
    try {
      const completionResult = await this.aiGateway.complete({
        provider: input.route.provider,
        model: input.route.model,
        prompt: input.prompt,
        agentId: input.route.agentId,
      });

      if (!completionResult.ok) {
        await this.conversations.recordAiError({
          userId: input.userId,
          conversationId: input.conversationId,
          messageId: input.userMessageId,
          stage: input.stage ?? "complete",
          severity: "error",
          errorCode: completionResult.error.code,
          errorMessage: completionResult.error.message,
          provider: input.route.provider,
          model: input.route.model,
          agentId: input.route.agentId,
          promptExcerpt: createPromptExcerpt(input.prompt),
        });
      }

      return completionResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI provider threw an unknown error.";
      await this.conversations.recordAiError({
        userId: input.userId,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        stage: input.stage ?? "complete",
        severity: "critical",
        errorCode: "provider_exception",
        errorMessage: message,
        provider: input.route.provider,
        model: input.route.model,
        agentId: input.route.agentId,
        promptExcerpt: createPromptExcerpt(input.prompt),
      });

      return fail(new DomainError("provider_unavailable", "AI provider is unavailable.", 503));
    }
  }
}

function createConversationTitle(message: string) {
  const title = message.replace(/\s+/g, " ").trim();
  return title.length > 48 ? `${title.slice(0, 45)}...` : title;
}

function createPromptExcerpt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
}

function normalizeAttachments(attachments: ChatAttachment[] | undefined) {
  return (attachments ?? []).slice(0, 5).map((attachment) => ({
    name: attachment.name.slice(0, 180),
    type: attachment.type?.slice(0, 120) || "application/octet-stream",
    size: attachment.size,
    content: attachment.content?.slice(0, 20_000),
    truncated: Boolean(attachment.truncated),
  }));
}

function buildPrompt(message: string, attachments: ChatAttachment[]) {
  if (attachments.length === 0) return message;

  const files = attachments
    .map((attachment, index) => {
      const header = [
        `File ${index + 1}: ${attachment.name}`,
        `type: ${attachment.type || "unknown"}`,
        `size: ${attachment.size} bytes`,
        attachment.truncated ? "content: truncated" : null,
      ]
        .filter(Boolean)
        .join(", ");

      if (!attachment.content?.trim()) {
        return `${header}\nContent was not extracted. Use the file name and metadata only.`;
      }

      return `${header}\nContent:\n${attachment.content}`;
    })
    .join("\n\n");

  return `${message}\n\nAttached files:\n${files}`;
}

function readAttachmentsFromMetadata(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isAttachmentLike)
    .map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      content: attachment.content,
      truncated: attachment.truncated,
    }));
}

function isAttachmentLike(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") return false;
  const attachment = value as Partial<ChatAttachment>;
  return typeof attachment.name === "string" && typeof attachment.size === "number";
}
