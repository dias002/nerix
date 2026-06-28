import type { Agent, AiModality, Language, WalletBalance } from "@nomduchat/shared";

const defaultApiUrl = resolveDefaultApiUrl();
const apiUrl = (import.meta.env.VITE_API_URL ?? defaultApiUrl).replace(/\/$/, "");
let accessToken: string | null = null;
let localRoleOverride: string | null = null;
const deviceIdStorageKey = "nomduchat-device-id";

function resolveDefaultApiUrl() {
  if (!import.meta.env.PROD) return "http://127.0.0.1:4000";
  if (typeof window !== "undefined" && window.location.hostname === "www.nomduchat.com") {
    return "https://api.nomduchat.com";
  }

  return "https://nomduchat-api.onrender.com";
}

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type UserApiRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: "KZ" | "RU" | string;
  language: Language;
  systemRole: "user" | "admin";
  workspaceRole: "personal" | "business_owner" | "business_employee";
  activePlanId: PlanId | string | null;
  businessWorkspace: {
    id: string;
    name: string;
    memberId: string | null;
    memberRoleKey: string | null;
    groupId: string | null;
    groupName: string | null;
  } | null;
  permissions: {
    adminPanel: boolean;
    globalMetrics: boolean;
    mailings: boolean;
    business: boolean;
    businessSettings: boolean;
    employeeReports: boolean;
  };
};

export type AuthApiResponse = {
  user: UserApiRecord;
  accessToken: string;
};

export type ChatApiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type ChatAnswerVariantApiRecord = {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  agentId: string | null;
  provider: string | null;
  model: string | null;
  variantIndex: number;
  status: "candidate" | "selected" | "rejected";
  isSelected: boolean;
  selectedByUserId: string | null;
  selectedAt: string | null;
  routeMetadata: Record<string, unknown>;
  providerUsage: Record<string, unknown>;
  qualityMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageFeedbackApiRecord = {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  answerVariantId: string | null;
  rating: "up" | "down" | "best" | "bad" | "needs_fix";
  selectedAsBest: boolean;
  reasonTags: string[];
  comment: string | null;
  createdAt: string;
};

export type ChatAttachmentInput = {
  name: string;
  type?: string;
  size: number;
  content?: string;
  truncated?: boolean;
};

export type ChatApiResponse = {
  conversationId: string;
  userMessage: ChatApiMessage | null;
  assistantMessage: ChatApiMessage | null;
  answerVariant?: ChatAnswerVariantApiRecord | null;
  generationJob?: MediaGenerationJobApiRecord;
  route: {
    agentId: string;
    provider: string;
    model: string;
    policyMode: string;
    estimatedCredits: number;
    reserveCredits: number;
    asyncJob: boolean;
    modality: AiModality;
    routingReason: string;
  };
  usage: {
    estimatedCredits: number;
    reserveCredits: number;
    finalCredits: number | null;
  };
};

export type MediaGenerationJobApiRecord = {
  id: string;
  userId: string;
  agentId?: string;
  modality: AiModality;
  status: "queued" | "running" | "succeeded" | "failed" | "refunded" | "cancelled";
  prompt: string;
  provider?: string;
  model?: string;
  reservationId?: string;
  resultUrl?: string;
  resultMimeType?: string;
  reservedCredits: number;
  finalCredits?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ChatConversationSummaryApiRecord = {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  preview: string;
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryItemApiRecord = {
  id: string;
  userId: string;
  title: string;
  content: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerApiEntry = {
  id: string;
  walletUserId: string;
  type: string;
  amountCredits: number;
  balanceAfterCredits: number;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
};

export type PlanApiPrice = {
  country: "KZ" | "RU";
  provider: "kaspi" | "yookassa";
  currency: "KZT" | "RUB";
  amountMinor: number;
  priceSource: "mashagpt_benchmark_draft" | "admin_fixed_rate";
};

export type PlanId = "base" | "ultra" | "pro" | "business";

export type PlanApiRecord = {
  id: PlanId;
  name: string;
  monthlyCredits: number;
  contextTokens: number;
  description: string;
  enabled: boolean;
  price: PlanApiPrice;
};

export type CurrentSubscriptionApiResponse = {
  subscription: {
    id: string;
    userId: string;
    planId: PlanId;
    status: "pending" | "active" | "cancelled" | "payment_failed";
    country: "KZ" | "RU";
    provider: "kaspi" | "yookassa";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type UsageLimitsApiResponse = {
  planId: string | null;
  hasActiveSubscription: boolean;
  text: {
    dailyLimit: number | null;
    usedToday: number | null;
    remainingToday: number | null;
  };
  media: {
    image: boolean;
    video: boolean;
    music: boolean;
    voice: boolean;
  };
};

export type SubscriptionCheckoutApiResponse = {
  checkout: {
    id: string;
    userId: string;
    planId: PlanId;
    country: "KZ" | "RU";
    provider: "kaspi" | "yookassa";
    currency: "KZT" | "RUB";
    amountMinor: number;
    status: "pending" | "completed" | "cancelled" | "failed";
    creditsGranted: boolean;
    providerCheckoutId: string;
    checkoutUrl: string;
    createdAt: string;
    updatedAt: string;
  };
  plan: {
    id: PlanId;
    name: string;
    monthlyCredits: number;
  };
};

export type SubscriptionCheckoutApiRecord = SubscriptionCheckoutApiResponse["checkout"];

export type SubscriptionCompleteApiResponse = {
  checkout: SubscriptionCheckoutApiResponse["checkout"];
  subscription: NonNullable<CurrentSubscriptionApiResponse["subscription"]>;
  wallet: WalletBalance;
};

export type AdminOverviewApiResponse = {
  businessDirection: {
    metrics: Array<{
      key: string;
      label: string;
      value: string;
      detail: string;
    }>;
    signals: Array<{
      title: string;
      detail: string;
      status: "good" | "attention" | "risk";
    }>;
    nextSteps: string[];
  };
  memory: {
    totalChats: number;
    totalMessages: number;
    summarizedChats: number;
    memoryItems: number;
    memoryTokens: number;
    memoryLimitTokens: number;
    fillPercent: number;
    privateNote: string;
  };
  paymentReport: AdminPaymentReportApiRecord;
  pricing: AdminPricingApiRecord;
};

export type AdminPaymentReportApiRecord = {
  providers: Array<{
    provider: "kaspi" | "yookassa";
    label: string;
    currency: "KZT" | "RUB";
    total: AdminPaymentStatApiRecord;
    paid: AdminPaymentStatApiRecord;
    pending: AdminPaymentStatApiRecord;
    cancelled: AdminPaymentStatApiRecord;
    failed: AdminPaymentStatApiRecord;
    creditsGrantedCount: number;
  }>;
  note: string;
};

export type AdminPaymentStatApiRecord = {
  count: number;
  amountMinor: number;
};

export type AdminPricingApiRecord = {
  exchangeRates: Array<{
    pair: "USD/RUB" | "USD/KZT" | "RUB/KZT";
    value: number;
    source: "cbr" | "nbk";
    sourceName: string;
    effectiveDate: string;
    fetchedAt: string;
    nextUpdateAt: string;
    stale: boolean;
    note: string;
  }>;
  plans: Array<{
    id: PlanId;
    name: string;
    monthlyCredits: number;
    contextTokens: number;
    description: string;
    enabled: boolean;
    prices: Array<{
      country: "KZ" | "RU";
      provider: "kaspi" | "yookassa";
      currency: "KZT" | "RUB";
      amountMinor: number;
      priceSource: "mashagpt_benchmark_draft" | "admin_fixed_rate";
    }>;
  }>;
};

export type AdminUserPaymentApiRecord = {
  id: string;
  planId: string;
  status: string;
  provider: string;
  currency: string;
  amountMinor: number;
  createdAt: string;
};

export type AdminUserProjectApiRecord = {
  id: string;
  name: string;
  type: string;
  status: string;
  assetsCount: number;
  updatedAt: string;
};

export type AdminUserApiRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string;
  language: string;
  systemRole: string;
  createdAt: string;
  updatedAt: string;
  activePlanId: string | null;
  subscriptionStatus: string | null;
  wallet: {
    availableCredits: number;
    reservedCredits: number;
  };
  activity: {
    chatsCount: number;
    messagesCount: number;
    totalCreditsSpent: number;
    freeCreditsSpent: number;
    filesCount: number;
    projectsCount: number;
    mediaAssetsCount: number;
    lastActivityAt: string | null;
  };
  payments: AdminUserPaymentApiRecord[];
  projects: AdminUserProjectApiRecord[];
};

export type AdminUsersApiResponse = {
  query: string;
  users: AdminUserApiRecord[];
  privacyNote: string;
};

export type AiProviderApiRecord = {
  code: string;
  name: string;
  enabled: boolean;
  modalities: AiModality[];
  reason: string;
};

export type AiProvidersApiResponse = {
  policyMode: string;
  providers: AiProviderApiRecord[];
};

export type AdminFeatureFlagApiRecord = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  audience: string;
  rolloutPercent: number;
  updatedAt: string;
};

export type AdminAiProviderSettingApiRecord = {
  code: string;
  name: string;
  enabled: boolean;
  backendConfigured: boolean;
  model: string;
  trafficMode: "primary" | "reserve" | "paused";
  modalities: AiModality[];
  reason: string;
  updatedAt: string;
};

export type AdminAgentApiRecord = {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  inputTypes: string[];
  outputTypes: string[];
  defaultModel: string;
  fallbackModels: string[];
  priceMultiplier: number;
};

export type AdminPromotionApiRecord = {
  slug: string;
  title: string;
  body: string;
  placement: string;
  audience: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  updatedAt: string;
};

export type AdminContentBlockApiRecord = {
  key: string;
  locale: string;
  title: string;
  body: string;
  placement: string;
  active: boolean;
  updatedAt: string;
};

export type AdminAuditApiRecord = {
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};

export type AdminControlStateApiResponse = {
  featureFlags: AdminFeatureFlagApiRecord[];
  aiProviders: AdminAiProviderSettingApiRecord[];
  agents: AdminAgentApiRecord[];
  promotions: AdminPromotionApiRecord[];
  contentBlocks: AdminContentBlockApiRecord[];
  auditLog: AdminAuditApiRecord[];
  policyMode: string;
  note: string;
};

export type AdminAiBudgetProviderApiRecord = {
  code: string;
  name: string;
  enabled: boolean;
  backendConfigured: boolean;
  trafficMode: "primary" | "reserve" | "paused";
  model: string;
  modalities: AiModality[];
  budgetUsd: number | null;
  balanceUsd: number | null;
  balanceSource: "manual_env" | "estimated_from_budget" | "not_configured";
  estimatedCreditsRemaining: number | null;
  spentCredits24h: number;
  spentCredits7d: number;
  spentCredits30d: number;
  spentUsd30d: number;
  requests24h: number;
  requests7d: number;
  requests30d: number;
  avgCreditsPerDay30d: number;
  avgUsdPerDay30d: number;
  daysRemaining: number | null;
  status: "ok" | "attention" | "risk" | "unknown";
  refillHint: string;
  lastActivityAt: string | null;
};

export type AdminAiBudgetApiResponse = {
  providers: AdminAiBudgetProviderApiRecord[];
  totals: {
    budgetUsd: number | null;
    balanceUsd: number | null;
    estimatedCreditsRemaining: number | null;
    spentCredits30d: number;
    spentUsd30d: number;
    avgUsdPerDay30d: number;
    daysRemaining: number | null;
    activeProviders: number;
    configuredProviders: number;
  };
  creditsPerUsd: number;
  generatedAt: string;
  note: string;
};

export type MailingAudienceApiRecord = {
  id: string;
  userId: string;
  name: string;
  source: string;
  contactsCount: number;
  activeContactsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MailingContactApiRecord = {
  id: string;
  userId: string;
  audienceId: string;
  email: string;
  name: string | null;
  status: "active" | "unsubscribed" | "bounced" | "invalid";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MailingCampaignApiRecord = {
  id: string;
  userId: string;
  audienceId: string;
  audienceName: string;
  name: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  tag: string;
  status: "draft" | "sending" | "sent" | "failed";
  totalCount: number;
  sentCount: number;
  openedCount: number;
  unsubscribedCount: number;
  bouncedCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailingRecipientApiRecord = {
  id: string;
  campaignId: string;
  contactId: string | null;
  email: string;
  name: string | null;
  status: "queued" | "sent" | "opened" | "bounced" | "unsubscribed" | "failed";
  smtpMessageId: string | null;
  openedAt: string | null;
  unsubscribedAt: string | null;
  lastEventAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailingImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  totalActiveContacts: number;
};

export type BusinessRoleKey = "owner" | "sales" | "support" | "marketing" | "developer";
export type BusinessMemberStatus = "online" | "away" | "offline";
export type BusinessAdvisorKey = "growth" | "sales" | "site" | "support";
export type BusinessIdeaStatus = "suggested" | "planned" | "in_progress" | "done";

export type BusinessRoleApiRecord = {
  key: BusinessRoleKey;
  title: string;
  description: string;
  permissions: string[];
};

export type BusinessMemberApiRecord = {
  id: string;
  workspaceId: string;
  userId: string | null;
  invitedEmail: string | null;
  name: string;
  roleKey: BusinessRoleKey;
  roleTitle: string;
  access: string;
  status: BusinessMemberStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessGroupApiRecord = {
  id: string;
  workspaceId: string;
  name: string;
  purpose: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type BusinessEmployeeReportApiRecord = {
  id: string;
  workspaceId: string;
  memberId: string | null;
  userId: string | null;
  employeeName: string;
  roleTitle: string;
  reportDate: string;
  requestsCount: number;
  chatsCount: number;
  clientReportsCount: number;
  lastActivityAt: string | null;
  summary: string;
};

export type BusinessDealNoteApiRecord = {
  id: string;
  dealId: string;
  text: string;
  createdAt: string;
};

export type BusinessDealApiRecord = {
  id: string;
  workspaceId: string;
  client: string;
  request: string;
  stage: string;
  amount: string;
  source: string;
  nextStep: string;
  problem: string;
  createdAt: string;
  updatedAt: string;
  notes: BusinessDealNoteApiRecord[];
};

export type BusinessIdeaApiRecord = {
  id: string;
  workspaceId: string;
  advisorKey: BusinessAdvisorKey;
  title: string;
  effort: string;
  effect: string;
  text: string;
  next: string;
  status: BusinessIdeaStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessAdvisorViewApiRecord = {
  key: BusinessAdvisorKey;
  title: string;
  short: string;
  summary: string;
  basedOn: string[];
  ideas: BusinessIdeaApiRecord[];
};

export type BusinessWorkspaceApiResponse = {
  workspace: {
    id: string;
    userId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  access: {
    mode: "demo" | "active";
    planRequired: "business";
    enabled: boolean;
    subscriptionPlanId: PlanId | null;
    message: string;
  };
  roles: BusinessRoleApiRecord[];
  members: BusinessMemberApiRecord[];
  groups: BusinessGroupApiRecord[];
  employeeReports: BusinessEmployeeReportApiRecord[];
  stats: Array<{ label: string; value: string; detail: string }>;
  knowledgeSources: string[];
  paidServices: Array<{ title: string; text: string; icon?: string; price?: string }>;
  pipeline: Array<{ title: string; count: number; amount: string }>;
  deals: BusinessDealApiRecord[];
  customerSignals: Array<{ tag: string; title: string; detail: string; tone: string }>;
  trafficSources: Array<{ source: string; value: number }>;
  advisorViews: BusinessAdvisorViewApiRecord[];
};

export type BusinessCustomerChannel = "telegram" | "website" | "manual";
export type BusinessCustomerMessageRole = "customer" | "bot" | "employee" | "system";
export type BusinessConversationRating = "bad" | "good" | "excellent";
export type BusinessConversationStatus = "new" | "qualified" | "waiting_human" | "won" | "lost";

export type BusinessConversationAnalysisApiRecord = {
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

export type BusinessCustomerMessageApiRecord = {
  id: string;
  conversationId: string;
  role: BusinessCustomerMessageRole;
  authorName: string;
  content: string;
  createdAt: string;
};

export type BusinessCustomerConversationApiRecord = {
  id: string;
  workspaceId: string;
  channel: BusinessCustomerChannel;
  customerName: string;
  customerContact: string;
  source: string;
  status: BusinessConversationStatus;
  ownerRating: BusinessConversationRating | null;
  aiRating: BusinessConversationRating;
  analysis: BusinessConversationAnalysisApiRecord;
  trainingAllowed: boolean;
  createdAt: string;
  updatedAt: string;
  messages: BusinessCustomerMessageApiRecord[];
};

export type BusinessTeamMessageApiRecord = {
  id: string;
  workspaceId: string;
  memberId: string | null;
  authorName: string;
  roleTitle: string;
  text: string;
  createdAt: string;
};

export type BusinessOpsOverviewApiResponse = {
  workspaceId: string;
  metrics: Array<{ label: string; value: string; detail: string }>;
  conversations: BusinessCustomerConversationApiRecord[];
  teamMessages: BusinessTeamMessageApiRecord[];
};

export type BusinessJobApiRecord = {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
  channel: "website" | "telegram" | "email" | "crm" | "internal";
  capability: "website_generation" | "bot_setup" | "campaign_generation" | "knowledge_ingest" | "workspace_analysis";
  taskType: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type BusinessJobsApiResponse = {
  workspaceId: string;
  jobs: BusinessJobApiRecord[];
};

export type CreateBusinessCustomerConversationInput = {
  channel: BusinessCustomerChannel;
  customerName?: string;
  customerContact?: string;
  source?: string;
  trainingAllowed?: boolean;
  messages: Array<{
    role: BusinessCustomerMessageRole;
    authorName?: string;
    content: string;
  }>;
};

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

export type TelegramBotPriceApiRecord = {
  country: TelegramBotCountry;
  currency: TelegramBotCurrency;
  amountMinor: number;
  label: string;
};

export type TelegramBotOrderApiRecord = {
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

export type TelegramBotTestReplyApiRecord = {
  orderId: string;
  customerMessage: string;
  reply: string;
  shouldEscalate: boolean;
  escalationContact: string;
  matchedKnowledge: string[];
};

export type TelegramBotProductApiResponse = {
  product: {
    title: string;
    description: string;
    prices: TelegramBotPriceApiRecord[];
    steps: string[];
  };
};

export type CreateTelegramBotOrderInput = {
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

export type TelegramMiniAppDraftApiRecord = {
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

export type BusinessWebsiteCountry = "KZ" | "RU";
export type BusinessWebsiteStatus = "draft" | "published";
export type BusinessWebsiteStyle = "clean" | "premium" | "bold" | "warm";
export type BusinessWebsiteType = "landing" | "services" | "catalog";
export type BusinessWebsiteSectionType =
  | "hero"
  | "services"
  | "benefits"
  | "pricing"
  | "faq"
  | "contacts"
  | "cta";

export type BusinessWebsiteThemeApiRecord = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
};

export type BusinessWebsiteSectionApiRecord = {
  id: string;
  type: BusinessWebsiteSectionType;
  title: string;
  subtitle?: string;
  body?: string;
  items?: string[];
  buttonText?: string;
  buttonHref?: string;
};

export type BusinessWebsiteContentApiRecord = {
  theme: BusinessWebsiteThemeApiRecord;
  seo: {
    title: string;
    description: string;
  };
  contact: {
    city?: string;
    phone?: string;
    telegram?: string;
    whatsapp?: string;
    instagram?: string;
  };
  pages: Array<{
    slug: "/";
    title: string;
    sections: BusinessWebsiteSectionApiRecord[];
  }>;
};

export type BusinessWebsiteApiRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  country: BusinessWebsiteCountry;
  status: BusinessWebsiteStatus;
  slug: string;
  title: string;
  prompt: string;
  siteType: BusinessWebsiteType;
  style: BusinessWebsiteStyle;
  content: BusinessWebsiteContentApiRecord;
  publicationPath: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CreateBusinessWebsiteDraftInput = {
  country: BusinessWebsiteCountry;
  prompt: string;
  companyName?: string;
  city?: string;
  contact?: string;
  style: BusinessWebsiteStyle;
  siteType: BusinessWebsiteType;
};

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function setApiLocalRoleOverride(role: string | null) {
  localRoleOverride = role && role !== "real" ? role : null;
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
  country?: "KZ" | "RU";
  language?: Language;
  turnstileToken?: string;
}) {
  return request<AuthApiResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: { email: string; password: string }) {
  return request<AuthApiResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser() {
  return request<{ user: UserApiRecord }>("/auth/me");
}

export async function exportCurrentUserData() {
  return request<unknown>("/users/me/export");
}

export async function deleteCurrentUser(confirmation: string) {
  return request<{
    userId: string;
    deletedAt: string;
    emailBeforeDeletion: string | null;
    retainedRecords: string[];
  }>("/users/me/delete", {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  });
}

export async function startOAuth(provider: "google" | "vk", returnTo = "/workspace") {
  return request<{ provider: "google" | "vk"; authorizationUrl: string }>(
    `/auth/oauth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`
  );
}

export async function getAgents() {
  return request<{ agents: Agent[] }>("/agents");
}

export async function getAiProviders() {
  return request<AiProvidersApiResponse>("/ai/providers");
}

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

export async function getPlans(country: "KZ" | "RU" = "KZ") {
  return request<{ country: "KZ" | "RU"; plans: PlanApiRecord[] }>(`/plans?country=${country}`);
}

export async function getWallet() {
  return request<WalletBalance>("/billing/wallet");
}

export async function getUsageLimits() {
  return request<UsageLimitsApiResponse>("/usage/limits");
}

export async function getLedger() {
  return request<{ entries: LedgerApiEntry[] }>("/billing/ledger");
}

export async function getCurrentSubscription() {
  return request<CurrentSubscriptionApiResponse>("/subscriptions/current");
}

export async function getSubscriptionCheckouts() {
  return request<{ checkouts: SubscriptionCheckoutApiRecord[] }>("/subscriptions/checkouts");
}

export async function getAdminOverview() {
  return request<AdminOverviewApiResponse>("/admin/overview");
}

export async function getAdminControlState() {
  return request<AdminControlStateApiResponse>("/admin/control");
}

export async function getAdminAiBudget() {
  return request<AdminAiBudgetApiResponse>("/admin/ai-budget");
}

export async function updateAdminFeatureFlag(
  key: string,
  input: Partial<Pick<AdminFeatureFlagApiRecord, "enabled" | "label" | "description" | "audience" | "rolloutPercent">>
) {
  return request<AdminControlStateApiResponse>(`/admin/control/feature-flags/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminAiProvider(
  code: string,
  input: Partial<Pick<AdminAiProviderSettingApiRecord, "enabled" | "model" | "trafficMode">>
) {
  return request<AdminControlStateApiResponse>(`/admin/control/ai-providers/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminAgent(id: string, input: Partial<Pick<AdminAgentApiRecord, "enabled">>) {
  return request<AdminControlStateApiResponse>(`/admin/control/agents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminPromotion(
  slug: string,
  input: Partial<
    Pick<
      AdminPromotionApiRecord,
      "title" | "body" | "placement" | "audience" | "active" | "startsAt" | "endsAt" | "priority"
    >
  >
) {
  return request<AdminControlStateApiResponse>(`/admin/control/promotions/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminContentBlock(
  key: string,
  input: Partial<Pick<AdminContentBlockApiRecord, "locale" | "title" | "body" | "placement" | "active">>
) {
  return request<AdminControlStateApiResponse>(`/admin/control/content-blocks/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function getAdminUsers(query = "") {
  const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return request<AdminUsersApiResponse>(`/admin/users${params}`);
}

export async function updateAdminPlanPrice(input: {
  planId: PlanId;
  country: "KZ" | "RU";
  amountMinor: number;
}) {
  return request<{ pricing: AdminPricingApiRecord }>("/admin/pricing", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function createSubscriptionCheckout(input: { planId: PlanId; country?: "KZ" | "RU"; customerEmail?: string | null }) {
  return request<SubscriptionCheckoutApiResponse>("/subscriptions/checkout", {
    method: "POST",
    body: JSON.stringify({
      planId: input.planId,
      country: input.country ?? "KZ",
      customerEmail: input.customerEmail ?? undefined,
    }),
  });
}

export async function completeMockSubscription(checkoutId: string) {
  return request<SubscriptionCompleteApiResponse>("/subscriptions/mock/complete", {
    method: "POST",
    body: JSON.stringify({
      checkoutId,
    }),
  });
}

export async function getMailingAudiences() {
  return request<{ audiences: MailingAudienceApiRecord[] }>("/mailings/audiences");
}

export async function createMailingAudience(input: { name: string }) {
  return request<{ audience: MailingAudienceApiRecord }>("/mailings/audiences", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function importMailingContacts(input: { audienceId: string; rawContacts: string }) {
  return request<{ summary: MailingImportSummary }>(`/mailings/audiences/${input.audienceId}/import`, {
    method: "POST",
    body: JSON.stringify({
      rawContacts: input.rawContacts,
    }),
  });
}

export async function getMailingContacts(audienceId: string) {
  return request<{ contacts: MailingContactApiRecord[] }>(`/mailings/audiences/${audienceId}/contacts`);
}

export async function getMailingCampaigns() {
  return request<{ campaigns: MailingCampaignApiRecord[] }>("/mailings/campaigns");
}

export async function createMailingCampaign(input: {
  audienceId: string;
  name: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}) {
  return request<{ campaign: MailingCampaignApiRecord }>("/mailings/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendMailingCampaign(campaignId: string) {
  return request<{
    campaign: MailingCampaignApiRecord;
    attempted: number;
    accepted: number;
    failed: number;
  }>(`/mailings/campaigns/${campaignId}/send`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function syncMailingCampaign(campaignId: string) {
  return request<{
    campaign: MailingCampaignApiRecord;
    updatedRecipients: number;
    opened: number;
    unsubscribed: number;
    bounced: number;
  }>(`/mailings/campaigns/${campaignId}/sync`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getMailingRecipients(campaignId: string) {
  return request<{ recipients: MailingRecipientApiRecord[] }>(`/mailings/campaigns/${campaignId}/recipients`);
}

export async function getBusinessWorkspace() {
  return request<BusinessWorkspaceApiResponse>("/business/workspace");
}

export async function addBusinessMember(input: {
  name: string;
  roleKey: BusinessRoleKey;
  invitedEmail?: string;
  roleTitle?: string;
  access?: string;
  status?: BusinessMemberStatus;
}) {
  return request<BusinessWorkspaceApiResponse>("/business/members", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addBusinessDealNote(dealId: string, text: string) {
  return request<BusinessWorkspaceApiResponse>(`/business/deals/${encodeURIComponent(dealId)}/notes`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function updateBusinessIdeaStatus(ideaId: string, status: BusinessIdeaStatus) {
  return request<BusinessWorkspaceApiResponse>(`/business/ideas/${encodeURIComponent(ideaId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getBusinessOpsOverview() {
  return request<BusinessOpsOverviewApiResponse>("/business/ops");
}

export async function getBusinessJobs() {
  return request<BusinessJobsApiResponse>("/business/jobs");
}

export async function getBusinessJob(jobId: string) {
  return request<{ workspaceId: string; job: BusinessJobApiRecord }>(`/business/jobs/${encodeURIComponent(jobId)}`);
}

export async function cancelBusinessJob(jobId: string) {
  return request<{ workspaceId: string; job: BusinessJobApiRecord }>(
    `/business/jobs/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function createBusinessCustomerConversation(input: CreateBusinessCustomerConversationInput) {
  return request<{
    conversation: BusinessCustomerConversationApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>("/business/ops/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addBusinessCustomerMessage(
  conversationId: string,
  input: {
    role: BusinessCustomerMessageRole;
    authorName?: string;
    content: string;
  }
) {
  return request<{
    conversation: BusinessCustomerConversationApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>(`/business/ops/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function rateBusinessCustomerConversation(conversationId: string, rating: BusinessConversationRating) {
  return request<{
    conversation: BusinessCustomerConversationApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>(`/business/ops/conversations/${encodeURIComponent(conversationId)}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export async function addBusinessTeamMessage(input: {
  memberId?: string | null;
  authorName: string;
  roleTitle?: string;
  text: string;
}) {
  return request<{
    message: BusinessTeamMessageApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>("/business/ops/team/messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getBusinessWebsites() {
  return request<{ websites: BusinessWebsiteApiRecord[] }>("/business/websites");
}

export async function createBusinessWebsiteDraft(input: CreateBusinessWebsiteDraftInput) {
  return request<{
    website: BusinessWebsiteApiRecord;
    assistantSummary: string;
    suggestedNextSteps: string[];
  }>("/business/websites/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBusinessWebsite(
  siteId: string,
  input: Partial<Pick<BusinessWebsiteApiRecord, "title" | "slug" | "content">>
) {
  return request<{ website: BusinessWebsiteApiRecord }>(`/business/websites/${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function publishBusinessWebsite(siteId: string) {
  return request<{ website: BusinessWebsiteApiRecord }>(
    `/business/websites/${encodeURIComponent(siteId)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function getPublicBusinessWebsite(slug: string) {
  return request<{ website: BusinessWebsiteApiRecord }>(`/public/websites/${encodeURIComponent(slug)}`);
}

export async function getTelegramBotProduct() {
  return request<TelegramBotProductApiResponse>("/telegram-bots/product");
}

export async function getTelegramBotOrders() {
  return request<{ orders: TelegramBotOrderApiRecord[] }>("/telegram-bots/orders");
}

export async function createTelegramBotOrder(input: CreateTelegramBotOrderInput) {
  return request<{ order: TelegramBotOrderApiRecord }>("/telegram-bots/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function testTelegramBotOrder(input: { orderId: string; message: string }) {
  return request<TelegramBotTestReplyApiRecord>(
    `/telegram-bots/orders/${encodeURIComponent(input.orderId)}/test-message`,
    {
      method: "POST",
      body: JSON.stringify({ message: input.message }),
    }
  );
}

export async function createTelegramMiniAppDraft(input: TelegramMiniAppDraftInput) {
  return request<{ draft: TelegramMiniAppDraftApiRecord }>("/telegram-bots/miniapp/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendChatMessage(input: {
  message: string;
  conversationId?: string;
  agentId?: string;
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
      message: input.message,
      attachments: input.attachments,
    }),
  });
}

export async function regenerateChatMessage(input: {
  conversationId: string;
  agentId?: string;
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

export async function refreshGenerationJob(jobId: string) {
  return request<{ job: MediaGenerationJobApiRecord }>(`/generation/jobs/${encodeURIComponent(jobId)}/refresh`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cancelGenerationJob(jobId: string) {
  return request<{ job: MediaGenerationJobApiRecord }>(`/generation/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchGenerationArtifact(jobId: string) {
  const headers = new Headers();
  appendClientHeaders(headers);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/generation/jobs/${encodeURIComponent(jobId)}/artifact`, {
      headers,
    });
  } catch (error) {
    throw new Error(isNetworkFetchError(error) ? "nomduchat_api_unavailable" : "nomduchat_api_request_failed");
  }

  if (!response.ok) {
    const body = await safeJson<ApiErrorResponse>(response);
    throw new Error(body?.error?.message ?? `nomduchat API request failed with ${response.status}.`);
  }

  return response.blob();
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  appendClientHeaders(headers);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new Error(isNetworkFetchError(error) ? "nomduchat_api_unavailable" : "nomduchat_api_request_failed");
  }

  if (!response.ok) {
    const body = await safeJson<ApiErrorResponse>(response);
    throw new Error(body?.error?.message ?? `nomduchat API request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function appendClientHeaders(headers: Headers) {
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (localRoleOverride && !headers.has("X-nomduchat-Local-Role")) {
    headers.set("X-nomduchat-Local-Role", localRoleOverride);
  }
  if (!headers.has("X-nomduchat-Device-Id")) {
    headers.set("X-nomduchat-Device-Id", getOrCreateDeviceId());
  }
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "server-render";

  const existing = window.localStorage.getItem(deviceIdStorageKey);
  if (existing) return existing;

  const nextId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(deviceIdStorageKey, nextId);
  return nextId;
}

export function toPublicApiError(error: unknown, fallback = "Не удалось выполнить действие.") {
  if (error instanceof Error && error.message === "nomduchat_api_unavailable") {
    return "API nomduchat сейчас не подключен. Действие станет доступно после запуска сервера.";
  }

  if (error instanceof Error && error.message === "nomduchat_api_request_failed") {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function isNetworkFetchError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && /failed to fetch|network|load failed/i.test(error.message));
}

async function safeJson<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
