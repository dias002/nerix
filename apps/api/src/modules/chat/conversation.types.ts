export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type ConversationRecord = {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ConversationSummaryRecord = {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  preview: string;
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryItemRecord = {
  id: string;
  userId: string;
  title: string;
  content: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnswerVariantStatus = "candidate" | "selected" | "rejected";

export type AnswerVariantRecord = {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  agentId: string | null;
  provider: string | null;
  model: string | null;
  variantIndex: number;
  status: AnswerVariantStatus;
  isSelected: boolean;
  selectedByUserId: string | null;
  selectedAt: string | null;
  routeMetadata: Record<string, unknown>;
  providerUsage: Record<string, unknown>;
  qualityMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MessageFeedbackRating = "up" | "down" | "best" | "bad" | "needs_fix";

export type MessageFeedbackRecord = {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  answerVariantId: string | null;
  rating: MessageFeedbackRating;
  selectedAsBest: boolean;
  reasonTags: string[];
  comment: string | null;
  createdAt: string;
};

export type AiErrorEventRecord = {
  id: string;
  userId: string | null;
  conversationId: string | null;
  messageId: string | null;
  answerVariantId: string | null;
  botId: string | null;
  stage: string;
  severity: "info" | "warning" | "error" | "critical";
  errorCode: string;
  errorMessage: string;
  provider: string | null;
  model: string | null;
  agentId: string | null;
  promptExcerpt: string | null;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  status: "open" | "resolved" | "ignored";
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
