import type { Agent, AiModality, Language, WalletBalance } from "@nerix/shared";

const apiUrl = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
let accessToken: string | null = null;
let localRoleOverride: string | null = null;

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

export async function startOAuth(provider: "google" | "vk", returnTo = "/workspace") {
  return request<{ provider: "google" | "vk"; authorizationUrl: string }>(
    `/auth/oauth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`
  );
}

export async function getAgents() {
  return request<{ agents: Agent[] }>("/agents");
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

export async function getLedger() {
  return request<{ entries: LedgerApiEntry[] }>("/billing/ledger");
}

export async function getCurrentSubscription() {
  return request<CurrentSubscriptionApiResponse>("/subscriptions/current");
}

export async function getAdminOverview() {
  return request<AdminOverviewApiResponse>("/admin/overview");
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

export async function createSubscriptionCheckout(input: { planId: PlanId; country?: "KZ" | "RU" }) {
  return request<SubscriptionCheckoutApiResponse>("/subscriptions/checkout", {
    method: "POST",
    body: JSON.stringify({
      planId: input.planId,
      country: input.country ?? "KZ",
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

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (localRoleOverride && !headers.has("X-Nerix-Local-Role")) {
    headers.set("X-Nerix-Local-Role", localRoleOverride);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await safeJson<ApiErrorResponse>(response);
    throw new Error(body?.error?.message ?? `Nerix API request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

async function safeJson<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
