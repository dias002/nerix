export type BusinessCustomerChannel = "telegram" | "website" | "manual";
export type BusinessCustomerMessageRole = "customer" | "bot" | "employee" | "system";
export type BusinessConversationRating = "bad" | "good" | "excellent";
export type BusinessConversationStatus = "new" | "qualified" | "waiting_human" | "won" | "lost";

export type BusinessConversationAnalysis = {
  summary: string;
  goal: string;
  intent: string;
  objections: string[];
  desiredProducts: string[];
  sentiment: "positive" | "neutral" | "negative";
  outcome: string;
  nextStep: string;
  score: number;
  tags: string[];
  trainingSignal: string;
};

export type BusinessCustomerMessageRecord = {
  id: string;
  conversationId: string;
  role: BusinessCustomerMessageRole;
  authorName: string;
  content: string;
  createdAt: string;
};

export type BusinessCustomerConversationRecord = {
  id: string;
  workspaceId: string;
  channel: BusinessCustomerChannel;
  customerName: string;
  customerContact: string;
  source: string;
  status: BusinessConversationStatus;
  ownerRating: BusinessConversationRating | null;
  aiRating: BusinessConversationRating;
  analysis: BusinessConversationAnalysis;
  trainingAllowed: boolean;
  createdAt: string;
  updatedAt: string;
  messages: BusinessCustomerMessageRecord[];
};

export type BusinessTeamMessageRecord = {
  id: string;
  workspaceId: string;
  memberId: string | null;
  authorName: string;
  roleTitle: string;
  text: string;
  createdAt: string;
};

export type BusinessOpsMetric = {
  label: string;
  value: string;
  detail: string;
};

export type BusinessOpsOverview = {
  workspaceId: string;
  metrics: BusinessOpsMetric[];
  conversations: BusinessCustomerConversationRecord[];
  teamMessages: BusinessTeamMessageRecord[];
};

export type CreateBusinessCustomerMessageInput = {
  role: BusinessCustomerMessageRole;
  content: string;
  authorName?: string;
};

export type CreateBusinessCustomerConversationInput = {
  channel: BusinessCustomerChannel;
  customerName?: string;
  customerContact?: string;
  source?: string;
  trainingAllowed?: boolean;
  messages: CreateBusinessCustomerMessageInput[];
};

export type CreateBusinessTeamMessageInput = {
  memberId?: string | null;
  authorName: string;
  roleTitle?: string;
  text: string;
};
