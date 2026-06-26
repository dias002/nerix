export type TelegramBotCountry = "KZ" | "RU";
export type TelegramBotCurrency = "KZT" | "RUB";
export type TelegramBotTone = "friendly" | "expert" | "sales" | "strict";
export type TelegramBotOrderStatus =
  | "draft"
  | "ready_for_payment"
  | "paid"
  | "in_setup"
  | "connected"
  | "cancelled";

export type TelegramBotPrice = {
  country: TelegramBotCountry;
  currency: TelegramBotCurrency;
  amountMinor: number;
  label: string;
};

export type CreateTelegramBotOrderInput = {
  userId: string;
  country: TelegramBotCountry;
  companyName: string;
  ownerName?: string;
  contact: string;
  businessDescription: string;
  services: string;
  audience?: string;
  botPurpose: string;
  tone: TelegramBotTone;
  responseRules: string;
  escalationContact: string;
  faq?: string;
  sourceLinks?: string;
  botUsername?: string;
  botToken?: string;
};

export type CreateTelegramBotOrderRepositoryInput = Omit<CreateTelegramBotOrderInput, "botToken"> & {
  currency: TelegramBotCurrency;
  amountMinor: number;
  status: TelegramBotOrderStatus;
  workspaceId: string | null;
  botTokenProvided: boolean;
  botTokenHint: string | null;
  setupSummary: string;
  systemPrompt: string;
};

export type TelegramBotOrderRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  country: TelegramBotCountry;
  currency: TelegramBotCurrency;
  amountMinor: number;
  status: TelegramBotOrderStatus;
  companyName: string;
  ownerName: string;
  contact: string;
  businessDescription: string;
  services: string;
  audience: string;
  botPurpose: string;
  tone: TelegramBotTone;
  responseRules: string;
  escalationContact: string;
  faq: string;
  sourceLinks: string;
  botUsername: string | null;
  botTokenProvided: boolean;
  botTokenHint: string | null;
  setupSummary: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
};

export type TelegramMiniAppDraftInput = {
  country: TelegramBotCountry;
  companyName: string;
  businessCategory: string;
  city?: string;
  contact: string;
  website?: string;
  mainOffer: string;
  priceInfo?: string;
  audience?: string;
  goals: string[];
  language?: "ru" | "kk" | "en";
  telegramInitData?: string;
};

export type TelegramMiniAppDraft = {
  country: TelegramBotCountry;
  currency: TelegramBotCurrency;
  amountMinor: number;
  priceLabel: string;
  companyName: string;
  botName: string;
  botUsernameSuggestions: string[];
  managedBotUrl: string | null;
  audience: string;
  botPurpose: string;
  tone: TelegramBotTone;
  businessDescription: string;
  services: string;
  responseRules: string;
  escalationContact: string;
  faq: string;
  sourceLinks: string;
  welcomeMessage: string;
  menuButtons: string[];
  commands: Array<{
    command: string;
    description: string;
  }>;
  setupSummary: string;
  systemPrompt: string;
  orderPayload: Omit<CreateTelegramBotOrderInput, "botToken">;
};
