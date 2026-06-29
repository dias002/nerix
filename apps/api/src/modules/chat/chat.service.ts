import type { CountryCode, Language } from "@nomduchat/shared";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { AiGatewayService } from "../ai-gateway/ai-gateway.service.js";
import type { GenerationService } from "../generation/generation.service.js";
import type { ConversationRepository } from "./conversation.repository.js";
import type { ConversationMessage, MessageFeedbackRating } from "./conversation.types.js";
import {
  buildConversationPrompt,
  buildMediaGenerationPrompt,
  buildPrompt,
  buildRoutingPrompt,
  createConversationTitle,
  createPromptExcerpt,
  normalizeAttachments,
  readAttachmentsFromMetadata,
  type ChatAttachment,
} from "./prompt-builder.js";
import { ChatUsagePolicy, type SubscriptionAccessService } from "./usage-policy.js";

export class ChatService {
  private readonly usagePolicy: ChatUsagePolicy;

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly aiGateway: AiGatewayService,
    private readonly generation?: GenerationService,
    subscriptions?: SubscriptionAccessService,
    usagePolicy?: ChatUsagePolicy
  ) {
    this.usagePolicy = usagePolicy ?? new ChatUsagePolicy(conversations, subscriptions);
  }

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

  async getUsageLimits(userId: string) {
    return this.usagePolicy.getUsageLimits(userId);
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
    const existingConversation = input.conversationId
      ? await this.conversations.findById(input.conversationId)
      : null;
    const routingPrompt = buildRoutingPrompt(existingConversation?.messages ?? [], prompt);

    if (input.conversationId && !existingConversation) {
      return fail(new DomainError("not_found", "Conversation was not found.", 404));
    }

    if (existingConversation && existingConversation.userId !== input.userId) {
      return fail(new DomainError("unauthorized", "Conversation belongs to another user.", 401));
    }

    const routeAgentId = input.agentId ?? existingConversation?.agentId;

    const routeResult = await this.aiGateway.route({
      userId: input.userId,
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      agentId: routeAgentId,
      prompt: routingPrompt,
    });
    if (!routeResult.ok) {
      await this.conversations.recordAiError({
        userId: input.userId,
        conversationId: existingConversation?.id ?? null,
        stage: "route",
        severity: "error",
        errorCode: routeResult.error.code,
        errorMessage: routeResult.error.message,
        agentId: routeAgentId ?? null,
        promptExcerpt: createPromptExcerpt(prompt),
        requestPayload: {
          country: input.country ?? "KZ",
          language: input.language ?? "ru",
          agentId: routeAgentId ?? null,
        },
      });
      return routeResult;
    }

    const limitResult = await this.assertRequestAllowed({
      userId: input.userId,
      route: routeResult.value,
    });
    if (!limitResult.ok) return limitResult;

    const conversation =
      existingConversation ??
      (await this.conversations.create({
        userId: input.userId,
        agentId: routeResult.value.agentId,
        title: createConversationTitle(message),
      }));

    if (!conversation) {
      return fail(new DomainError("not_found", "Conversation was not found.", 404));
    }

    const previousMessages = [...conversation.messages];
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

    if (routeResult.value.asyncJob) {
      const mediaResult = await this.startMediaGeneration({
        userId: input.userId,
        country: input.country ?? "KZ",
        language: input.language ?? "ru",
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        prompt: buildMediaGenerationPrompt(previousMessages, prompt),
        route: routeResult.value,
      });
      if (!mediaResult.ok) return mediaResult;

      return mediaResult;
    }

    const completionResult = await this.completeSafely({
      userId: input.userId,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      prompt: buildConversationPrompt(previousMessages, prompt),
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

    const lastUserMessageIndex = findLastUserMessageIndex(conversation.messages);
    const userMessage = lastUserMessageIndex >= 0 ? conversation.messages[lastUserMessageIndex] : null;
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
      agentId: input.agentId ?? metadataAgentId ?? conversation.agentId,
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
        agentId: input.agentId ?? metadataAgentId ?? conversation.agentId ?? null,
        promptExcerpt: createPromptExcerpt(prompt),
      });
      return routeResult;
    }

    const limitResult = await this.assertRequestAllowed({
      userId: input.userId,
      route: routeResult.value,
    });
    if (!limitResult.ok) return limitResult;

    if (routeResult.value.asyncJob) {
      return fail(new DomainError("validation_failed", "Media generation regeneration is not supported yet.", 400));
    }

    const completionResult = await this.completeSafely({
      userId: input.userId,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      prompt: buildConversationPrompt(conversation.messages.slice(0, lastUserMessageIndex), prompt),
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

  private async startMediaGeneration(input: {
    userId: string;
    country: CountryCode;
    language: Language;
    conversationId: string;
    userMessageId: string;
    prompt: string;
    route: {
      agentId: string;
      provider: string;
      model: string;
      estimatedCredits: number;
      reserveCredits: number;
      asyncJob: boolean;
      modality: "image" | "video" | "music" | "voice" | "text" | "code" | "file";
      policyMode: string;
      routingReason: string;
    };
  }) {
    if (!this.generation) {
      return fail(new DomainError("provider_unavailable", "Media generation service is not configured.", 503));
    }

    const generationResult = await this.generation.createJob({
      userId: input.userId,
      country: input.country,
      language: input.language,
      agentId: input.route.agentId,
      modality: input.route.modality,
      prompt: input.prompt,
    });
    if (!generationResult.ok) return generationResult;

    const job = generationResult.value.job;
    const content =
      job.status === "succeeded"
        ? `Готово. Я создал ${mediaLabel(job.modality)}: ${job.resultUrl ?? "результат сохранен в медиатеке."}`
        : job.status === "running"
          ? `Генерирую ${mediaLabel(job.modality)}. Как только файл будет готов, он появится прямо здесь.`
          : `Генерация ${mediaLabel(job.modality)} не завершилась: ${job.errorMessage ?? "ошибка провайдера"}. Кредиты возвращены.`;

    const assistantMessage = await this.conversations.appendMessage(input.conversationId, {
      role: "assistant",
      content,
      metadata: {
        route: input.route,
        generationJob: job,
      },
    });
    if (!assistantMessage) {
      return fail(new DomainError("internal_error", "Assistant message could not be stored.", 500));
    }

    const answerVariant = await this.conversations.recordAnswerVariant({
      conversationId: input.conversationId,
      userMessageId: input.userMessageId,
      assistantMessageId: assistantMessage.id,
      agentId: input.route.agentId,
      provider: input.route.provider,
      model: input.route.model,
      routeMetadata: {
        ...input.route,
        generationJobId: job.id,
      },
      providerUsage: {
        generationJobId: job.id,
        status: job.status,
        finalCredits: job.finalCredits ?? null,
      },
    });

    return ok({
      conversationId: input.conversationId,
      assistantMessage,
      answerVariant,
      route: input.route,
      generationJob: job,
      usage: {
        estimatedCredits: input.route.estimatedCredits,
        reserveCredits: input.route.reserveCredits,
        finalCredits: job.finalCredits ?? null,
      },
    });
  }

  private async assertRequestAllowed(input: { userId: string; route: { agentId: string; modality: string } }) {
    return this.usagePolicy.assertRequestAllowed(input);
  }
}

function findLastUserMessageIndex(messages: ConversationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return index;
  }

  return -1;
}

function mediaLabel(modality: string) {
  if (modality === "image") return "изображение";
  if (modality === "video") return "видео";
  if (modality === "music") return "трек";
  if (modality === "voice") return "озвучку";
  return "медиа";
}
