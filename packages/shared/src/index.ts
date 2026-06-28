export type Language = "ru" | "kz" | "en";
import type { CountryCode } from "./countries.js";
export { countryCodes, isCountryCode, normalizeCountryCode, type CountryCode } from "./countries.js";

export type AgentCategory =
  | "general"
  | "code"
  | "business"
  | "study"
  | "image"
  | "video"
  | "music"
  | "voice"
  | "documents"
  | "marketing"
  | "support";

export type AiModality = "text" | "code" | "image" | "video" | "music" | "voice" | "file";

export type AiTaskType =
  | "chat_reply"
  | "customer_support"
  | "deal_summary"
  | "website_copy"
  | "campaign_copy"
  | "bot_policy"
  | "knowledge_search"
  | "internal_analysis"
  | "code_generation"
  | "media_generation";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "refunded" | "cancelled";

export type LedgerEntryType =
  | "topup"
  | "reserve"
  | "capture"
  | "refund"
  | "bonus"
  | "adjustment"
  | "subscription_charge";

export type Agent = {
  id: string;
  name: string;
  category: AgentCategory;
  description: string;
  inputTypes: AiModality[];
  outputTypes: AiModality[];
  defaultModel: string;
  fallbackModels: string[];
  priceMultiplier: number;
  enabled: boolean;
};

export type WalletBalance = {
  userId: string;
  availableCredits: number;
  reservedCredits: number;
  currency: "NOMDUCHAT";
};

export type AiRouteRequest = {
  userId: string;
  country: CountryCode;
  language: Language;
  agentId?: string;
  taskType?: AiTaskType;
  modality: AiModality;
  prompt: string;
  attachmentIds?: string[];
};

export type AiRouteDecision = {
  agentId: string;
  taskType: AiTaskType;
  provider: string;
  model: string;
  estimatedCredits: number;
  asyncJob: boolean;
};
