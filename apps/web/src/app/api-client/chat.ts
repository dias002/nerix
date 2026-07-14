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
import { request, requestStream } from "./transport";

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

export type ChatStreamStartEvent = {
  conversationId: string;
  userMessage: ChatApiMessage;
  route: ChatApiResponse["route"];
  usage: ChatApiResponse["usage"];
};

export type ChatStreamHandlers = {
  onStart?: (event: ChatStreamStartEvent) => void;
  onDelta?: (delta: string) => void;
};

type ChatStreamEvent =
  | { event: "start"; data: ChatStreamStartEvent }
  | { event: "delta"; data: { delta?: string } }
  | { event: "done"; data: ChatApiResponse }
  | { event: "error"; data: { code?: string; message?: string } };

export async function sendChatMessageStream(input: {
  message: string;
  conversationId?: string;
  agentId?: string;
  selectedModelId?: string;
  responseStyle?: ResponseStyleId;
  language?: Language;
  country?: "KZ" | "RU";
  attachments?: ChatAttachmentInput[];
}, handlers: ChatStreamHandlers = {}) {
  const response = await requestStream("/chat/messages/stream", {
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

  if (!response.body) {
    throw new Error("nomduchat_api_request_failed");
  }

  let finalResponse: ChatApiResponse | null = null;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = parseChatStreamEvent(chunk);
      if (!event) continue;

      if (event.event === "start") {
        handlers.onStart?.(event.data);
        continue;
      }

      if (event.event === "delta") {
        const delta = event.data.delta;
        if (delta) handlers.onDelta?.(delta);
        continue;
      }

      if (event.event === "done") {
        finalResponse = event.data;
        continue;
      }

      if (event.event === "error") {
        throw new Error(event.data.message ?? "Не удалось получить ответ.");
      }
    }
  }

  if (buffer.trim()) {
    const event = parseChatStreamEvent(buffer);
    if (event?.event === "done") finalResponse = event.data;
    if (event?.event === "error") throw new Error(event.data.message ?? "Не удалось получить ответ.");
  }

  if (!finalResponse) {
    throw new Error("Не удалось получить финальный ответ.");
  }

  return finalResponse;
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

function parseChatStreamEvent(rawEvent: string): ChatStreamEvent | null {
  const lines = rawEvent.split(/\r?\n/);
  const eventName = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
    .trim();

  if (!eventName || !data) return null;

  try {
    return {
      event: eventName,
      data: JSON.parse(data),
    } as ChatStreamEvent;
  } catch {
    return null;
  }
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
