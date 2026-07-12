import type { Language } from "@nomduchat/shared";
import type { ResponseStyleId } from "../responsePreferences";
import type {
  ChatAnswerVariantApiRecord,
  ChatApiMessage,
  ChatApiResponse,
  ChatAttachmentInput,
  ChatConversationSummaryApiRecord,
  ChatMessageFeedbackApiRecord,
  MemoryItemApiRecord,
} from "./index";
import { request } from "./transport";

export async function getChatConversations() {
  return request<{ conversations: ChatConversationSummaryApiRecord[] }>("/chat/conversations");
}

export async function getChatConversation(conversationId: string) {
  return request<{ conversation: {
    id: string;
    userId: string;
    agentId: string;
    title: string;
    messages: ChatApiMessage[];
    createdAt: string;
    updatedAt: string;
  } }>(`/chat/conversations/${encodeURIComponent(conversationId)}`);
}

export async function getMemoryItems() {
  return request<{ items: MemoryItemApiRecord[] }>("/memory/items");
}

export async function sendChatMessage(input: {
  message: string;
  conversationId?: string;
  agentId?: string;
  selectedModelId?: string;
  responseStyle?: ResponseStyleId;
  language?: Language;
  country?: "KZ" | "RU";
  attachments?: ChatAttachmentInput[];
}) {
  return request<ChatApiResponse>("/chat/messages", {
    method: "POST",
    body: JSON.stringify({
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      conversationId: input.conversationId,
      agentId: input.agentId,
      selectedModelId: input.selectedModelId,
      responseStyle: input.responseStyle,
      message: input.message,
      attachments: input.attachments,
    }),
  });
}

export async function regenerateChatMessage(input: {
  conversationId: string;
  agentId?: string;
  selectedModelId?: string;
  responseStyle?: ResponseStyleId;
  language?: Language;
  country?: "KZ" | "RU";
}) {
  return request<ChatApiResponse>("/chat/messages/regenerate", {
    method: "POST",
    body: JSON.stringify({
      country: input.country ?? "KZ",
      language: input.language ?? "ru",
      conversationId: input.conversationId,
      agentId: input.agentId,
      selectedModelId: input.selectedModelId,
      responseStyle: input.responseStyle,
    }),
  });
}

export async function selectBestChatAnswer(input: { conversationId: string; assistantMessageId: string }) {
  return request<{
    conversationId: string;
    assistantMessage: ChatApiMessage;
    answerVariant: ChatAnswerVariantApiRecord;
  }>(`/chat/answers/${encodeURIComponent(input.assistantMessageId)}/select`, {
    method: "POST",
    body: JSON.stringify({
      conversationId: input.conversationId,
    }),
  });
}

export async function submitChatMessageFeedback(input: {
  conversationId: string;
  messageId: string;
  rating?: "up" | "down" | "best" | "bad" | "needs_fix";
  selectedAsBest?: boolean;
  reasonTags?: string[];
  comment?: string;
}) {
  return request<{
    feedback: ChatMessageFeedbackApiRecord;
    answerVariant: ChatAnswerVariantApiRecord | null;
  }>(`/chat/messages/${encodeURIComponent(input.messageId)}/feedback`, {
    method: "POST",
    body: JSON.stringify({
      conversationId: input.conversationId,
      rating: input.rating ?? "up",
      selectedAsBest: input.selectedAsBest ?? false,
      reasonTags: input.reasonTags ?? [],
      comment: input.comment,
    }),
  });
}
