import { ok } from "../../domain/result.js";
import { config } from "../../config.js";
import type { DatabaseClient } from "../../database/index.js";
import { getConfiguredProviders, getProviderPolicyMode } from "../ai-gateway/provider-registry.js";
import { seedAgents } from "../agents/agent.repository.js";
import type { AgentService } from "../agents/agent.service.js";
import type { AgentRecord } from "../agents/agent.types.js";
import type { PlanId, SubscriptionCountry } from "../subscriptions/subscription.types.js";
import { providerForCountry, subscriptionPlans } from "../subscriptions/plans.js";
import { toPublicUserId } from "../users/local-user.js";

export type AdminMetricRecord = {
  key: string;
  label: string;
  value: string;
  detail: string;
};

export type AdminOverview = {
  businessDirection: {
    metrics: AdminMetricRecord[];
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
  paymentReport: AdminPaymentReport;
  pricing: AdminPricingState;
};

export type AdminFeatureFlagRecord = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  audience: string;
  rolloutPercent: number;
  updatedAt: string;
};

export type AdminAiProviderSettingRecord = {
  code: string;
  name: string;
  enabled: boolean;
  backendConfigured: boolean;
  model: string;
  trafficMode: "primary" | "reserve" | "paused";
  modalities: string[];
  reason: string;
  updatedAt: string;
};

export type AdminAgentRecord = {
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

export type AdminPromotionRecord = {
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

export type AdminContentBlockRecord = {
  key: string;
  locale: string;
  title: string;
  body: string;
  placement: string;
  active: boolean;
  updatedAt: string;
};

export type PublicContentBlockRecord = Pick<
  AdminContentBlockRecord,
  "key" | "locale" | "title" | "body" | "placement" | "updatedAt"
>;

export type PublicContentBlocks = {
  contentBlocks: PublicContentBlockRecord[];
};

export type AdminAuditRecord = {
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};

export type AdminIntegrationCheckStatus = "ok" | "attention" | "missing" | "manual";

export type AdminIntegrationCheckRecord = {
  key: string;
  category: string;
  label: string;
  status: AdminIntegrationCheckStatus;
  configured: boolean;
  detail: string;
  action: string;
};

export type AdminControlState = {
  featureFlags: AdminFeatureFlagRecord[];
  aiProviders: AdminAiProviderSettingRecord[];
  agents: AdminAgentRecord[];
  promotions: AdminPromotionRecord[];
  contentBlocks: AdminContentBlockRecord[];
  integrationChecks: AdminIntegrationCheckRecord[];
  auditLog: AdminAuditRecord[];
  policyMode: string;
  note: string;
};

export type AdminAiBudgetProviderStatus = "ok" | "attention" | "risk" | "unknown";

export type AdminAiBudgetProviderRecord = {
  code: string;
  name: string;
  enabled: boolean;
  backendConfigured: boolean;
  trafficMode: "primary" | "reserve" | "paused";
  model: string;
  modalities: string[];
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
  status: AdminAiBudgetProviderStatus;
  refillHint: string;
  lastActivityAt: string | null;
};

export type AdminAiBudgetState = {
  providers: AdminAiBudgetProviderRecord[];
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

export type AdminPaymentProviderCode = "kaspi" | "yookassa";

export type AdminPaymentStat = {
  count: number;
  amountMinor: number;
};

export type AdminPaymentProviderReport = {
  provider: AdminPaymentProviderCode;
  label: string;
  currency: "KZT" | "RUB";
  total: AdminPaymentStat;
  paid: AdminPaymentStat;
  pending: AdminPaymentStat;
  cancelled: AdminPaymentStat;
  failed: AdminPaymentStat;
  creditsGrantedCount: number;
};

export type AdminPaymentReport = {
  providers: AdminPaymentProviderReport[];
  note: string;
};

export type AdminUserPaymentRecord = {
  id: string;
  planId: string;
  status: string;
  provider: string;
  currency: "KZT" | "RUB" | string;
  amountMinor: number;
  createdAt: string;
};

export type AdminUserProjectRecord = {
  id: string;
  name: string;
  type: string;
  status: string;
  assetsCount: number;
  updatedAt: string;
};

export type AdminUserRecord = {
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
  payments: AdminUserPaymentRecord[];
  projects: AdminUserProjectRecord[];
};

export type AdminUserSearchResult = {
  query: string;
  users: AdminUserRecord[];
  privacyNote: string;
};

type CountRow = {
  count: string | number;
} & Record<string, unknown>;

type SumRow = {
  value: string | number | null;
} & Record<string, unknown>;

type PlanPriceRow = {
  slug: string;
  name: string;
  monthly_credits: string | number;
  context_tokens: string | number;
  description: string;
  enabled: boolean;
  country_code: string;
  provider: string;
  currency: "KZT" | "RUB";
  amount_minor: string | number;
  price_source: string;
} & Record<string, unknown>;

type PaymentReportRow = {
  provider: string;
  currency: "KZT" | "RUB";
  status: string;
  count: string | number;
  amount_minor: string | number | null;
  credits_granted_count: string | number | null;
} & Record<string, unknown>;

type AdminUserSearchRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string;
  language: string;
  system_role: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  active_plan_id: string | null;
  subscription_status: string | null;
  available_credits: string | number | null;
  reserved_credits: string | number | null;
  chats_count: string | number | null;
  messages_count: string | number | null;
  total_credits_spent: string | number | null;
  free_credits_spent: string | number | null;
  files_count: string | number | null;
  projects_count: string | number | null;
  media_assets_count: string | number | null;
  last_activity_at: Date | string | null;
  payments: unknown;
  projects: unknown;
} & Record<string, unknown>;

type FeatureFlagRow = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  audience: string;
  rollout_percent: string | number;
  updated_at: Date | string;
} & Record<string, unknown>;

type AiProviderSettingRow = {
  provider_code: string;
  name: string;
  enabled: boolean;
  model: string;
  traffic_mode: string;
  modalities: string[];
  metadata: unknown;
  updated_at: Date | string;
} & Record<string, unknown>;

type AiBudgetUsageRow = {
  provider: string | null;
  requests_24h: string | number | null;
  requests_7d: string | number | null;
  requests_30d: string | number | null;
  credits_24h: string | number | null;
  credits_7d: string | number | null;
  credits_30d: string | number | null;
  last_activity_at: Date | string | null;
} & Record<string, unknown>;

type PromotionRow = {
  slug: string;
  title: string;
  body: string;
  placement: string;
  audience: string;
  active: boolean;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  priority: string | number;
  updated_at: Date | string;
} & Record<string, unknown>;

type ContentBlockRow = {
  key: string;
  locale: string;
  title: string;
  body: string;
  placement: string;
  active: boolean;
  updated_at: Date | string;
} & Record<string, unknown>;

type AuditLogRow = {
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Date | string;
} & Record<string, unknown>;

export type AdminPricingState = {
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
      country: SubscriptionCountry;
      provider: "kaspi" | "yookassa";
      currency: "KZT" | "RUB";
      amountMinor: number;
      priceSource: "mashagpt_benchmark_draft" | "admin_fixed_rate";
    }>;
  }>;
};

const exchangeRateTtlMs = 24 * 60 * 60 * 1000;
const cbrDailyUrl = "https://www.cbr.ru/scripts/XML_daily.asp";
const nbkDailyUrl = "https://nationalbank.kz/rss/rates_all.xml";
const aiBudgetProviderCodes = ["openai", "anthropic", "gemini"] as const;
type AiBudgetProviderCode = (typeof aiBudgetProviderCodes)[number];

export class AdminService {
  private exchangeRateCache: { expiresAt: number; rates: AdminPricingState["exchangeRates"] } | null = null;
  private pricingSeeded = false;
  private controlSeeded = false;

  constructor(
    private readonly database: DatabaseClient,
    private readonly agents: AgentService
  ) {}

  async overview() {
    const [
      users,
      conversations,
      messages,
      subscriptions,
      businessWorkspaces,
      businessMembers,
      bots,
      errors,
      mailingAudiences,
      mailingContacts,
      mailingCampaigns,
      sentMailingCampaigns,
      todayMessages,
      todayEmployeeActivities,
      todayEmployeeReports,
      summarizedChats,
      memoryItems,
      memoryTokens,
      paymentReport,
      pricing,
    ] = await Promise.all([
      this.count("users"),
      this.count("conversations"),
      this.count("messages"),
      this.count("subscriptions", "status = 'active'"),
      this.count("business_workspaces"),
      this.count("business_members"),
      this.count("custom_ai_bots"),
      this.count("ai_error_events", "status = 'open'"),
      this.count("mailing_audiences"),
      this.count("mailing_contacts"),
      this.count("mailing_campaigns"),
      this.count("mailing_campaigns", "status in ('sending', 'sent')"),
      this.count("messages", "created_at >= current_date"),
      this.count("business_employee_activity", "created_at >= current_date"),
      this.count("business_employee_daily_reports", "report_date = current_date"),
      this.count("conversation_summaries"),
      this.count("memory_items"),
      this.sum("conversation_summaries", "token_count"),
      this.paymentReport(),
      this.pricingState(),
    ]);

    return ok<AdminOverview>({
      businessDirection: {
        metrics: [
          { key: "users", label: "Пользователи", value: formatNumber(users), detail: "Размер текущей базы" },
          { key: "subscriptions", label: "Активные подписки", value: formatNumber(subscriptions), detail: "Платная база проекта" },
          { key: "business", label: "Business кабинеты", value: formatNumber(businessWorkspaces), detail: "Компании в рабочем контуре" },
          { key: "members", label: "Сотрудники компаний", value: formatNumber(businessMembers), detail: "Назначенные роли внутри Business" },
          { key: "bots", label: "ИИ-боты", value: formatNumber(bots), detail: "Созданные или готовящиеся боты" },
          { key: "mailing_campaigns", label: "Рассылки", value: formatNumber(mailingCampaigns), detail: `${formatNumber(sentMailingCampaigns)} отправлено или в отправке` },
          { key: "mailing_contacts", label: "Контакты рассылок", value: formatNumber(mailingContacts), detail: `${formatNumber(mailingAudiences)} баз контактов` },
          { key: "errors", label: "Открытые ошибки", value: formatNumber(errors), detail: "Что мешает качеству ответов" },
        ],
        signals: [
          {
            title: "Business направление",
            detail: `${formatNumber(businessWorkspaces)} кабинетов, ${formatNumber(businessMembers)} сотрудников, ${formatNumber(todayEmployeeReports)} отчетов сегодня.`,
            status: businessWorkspaces > 0 ? "good" : "attention",
          },
          {
            title: "Качество ИИ",
            detail: errors > 0 ? `${formatNumber(errors)} открытых ошибок нужно разобрать.` : "Открытых ошибок качества нет.",
            status: errors > 0 ? "risk" : "good",
          },
          {
            title: "Операционная активность",
            detail: `${formatNumber(todayMessages)} сообщений сегодня, ${formatNumber(todayEmployeeActivities)} бизнес-действий сотрудников.`,
            status: todayMessages > 0 || todayEmployeeActivities > 0 ? "good" : "attention",
          },
        ],
        nextSteps: [
          "Усилить Business тариф: роли, отчеты сотрудников, CRM и бизнес-агент.",
          "Держать память как агрегаты: количество чатов, сообщений, summary и заполнение, без просмотра содержимого.",
          "Управлять прайсом централизованно через админ-панель и дневные официальные курсы валют.",
        ],
      },
      memory: {
        totalChats: conversations,
        totalMessages: messages,
        summarizedChats,
        memoryItems,
        memoryTokens,
        memoryLimitTokens: 2_000_000,
        fillPercent: Math.min(100, Math.round((memoryTokens / 2_000_000) * 100)),
        privateNote: "Админ видит только счетчики и заполнение памяти. Содержимое чатов и сообщений не выводится.",
      },
      paymentReport,
      pricing,
    });
  }

  async updatePlanPrice(input: { planId: PlanId; country: SubscriptionCountry; amountMinor: number }) {
    try {
      await this.ensurePricingSeeded();
      const provider = providerForCountry(input.country);
      const currency = currencyForCountry(input.country);
      await this.database.query(
        `
          insert into plan_prices (plan_id, country_code, provider, currency, amount_minor, price_source)
          select id, $2, $3, $4, $5, 'admin_fixed_rate'
          from plans
          where slug = $1
          on conflict (plan_id, country_code) do update set
            provider = excluded.provider,
            currency = excluded.currency,
            amount_minor = excluded.amount_minor,
            price_source = 'admin_fixed_rate',
            updated_at = now()
        `,
        [input.planId, input.country, provider, currency, input.amountMinor]
      );
    } catch {
      return this.pricingState();
    }

    return this.pricingState();
  }

  async searchUsers(query = "") {
    const normalizedQuery = query.trim();
    try {
      const result = await this.database.query<AdminUserSearchRow>(
        `
          with matched_users as (
            select *
            from users u
            where $1 = ''
              or u.id::text = $1
              or coalesce(u.email, '') ilike '%' || $1 || '%'
              or coalesce(u.phone, '') ilike '%' || $1 || '%'
              or coalesce(u.display_name, '') ilike '%' || $1 || '%'
            order by u.created_at desc
            limit 50
          )
          select
            u.id,
            u.display_name,
            u.email,
            u.phone,
            u.country_code,
            u.language,
            u.system_role,
            u.created_at,
            u.updated_at,
            sub.plan_slug as active_plan_id,
            sub.status as subscription_status,
            coalesce(w.available_credits, 0)::text as available_credits,
            coalesce(w.reserved_credits, 0)::text as reserved_credits,
            coalesce(chats.count, 0)::text as chats_count,
            coalesce(messages.count, 0)::text as messages_count,
            coalesce(usage.total_credits_spent, 0)::text as total_credits_spent,
            coalesce(free_usage.free_credits_spent, 0)::text as free_credits_spent,
            coalesce(files.count, 0)::text as files_count,
            coalesce(project_totals.count, 0)::text as projects_count,
            coalesce(media.count, 0)::text as media_assets_count,
            nullif(
              greatest(
                coalesce(chats.last_activity_at, 'epoch'::timestamptz),
                coalesce(messages.last_activity_at, 'epoch'::timestamptz),
                coalesce(usage.last_activity_at, 'epoch'::timestamptz),
                coalesce(payments_last.last_activity_at, 'epoch'::timestamptz),
                coalesce(project_totals.last_activity_at, 'epoch'::timestamptz),
                coalesce(media.last_activity_at, 'epoch'::timestamptz)
              ),
              'epoch'::timestamptz
            ) as last_activity_at,
            coalesce(payments.items, '[]'::jsonb) as payments,
            coalesce(projects.items, '[]'::jsonb) as projects
          from matched_users u
          left join wallets w on w.user_id = u.id and w.currency = 'NOMDUCHAT'
          left join lateral (
            select s.plan_slug, s.status
            from subscriptions s
            where s.user_id = u.id
            order by (s.status = 'active') desc, s.created_at desc
            limit 1
          ) sub on true
          left join lateral (
            select count(*) as count, max(c.updated_at) as last_activity_at
            from conversations c
            where c.user_id = u.id
          ) chats on true
          left join lateral (
            select count(*) as count, max(m.created_at) as last_activity_at
            from conversations c
            join messages m on m.conversation_id = c.id
            where c.user_id = u.id
          ) messages on true
          left join lateral (
            select coalesce(sum(ue.charged_credits), 0) as total_credits_spent, max(ue.created_at) as last_activity_at
            from usage_events ue
            where ue.user_id = u.id
          ) usage on true
          left join lateral (
            select coalesce(sum(ue.charged_credits), 0) as free_credits_spent
            from usage_events ue
            where ue.user_id = u.id
              and not exists (
                select 1
                from subscription_checkouts sc
                where sc.user_id = u.id
                  and sc.status = 'completed'
                  and sc.created_at <= ue.created_at
              )
          ) free_usage on true
          left join lateral (
            select count(*) as count
            from files f
            where f.user_id = u.id
          ) files on true
          left join lateral (
            select count(*) as count, max(p.updated_at) as last_activity_at
            from user_projects p
            where p.user_id = u.id
          ) project_totals on true
          left join lateral (
            select count(*) as count, max(a.updated_at) as last_activity_at
            from user_media_assets a
            where a.user_id = u.id
          ) media on true
          left join lateral (
            select max(sc.created_at) as last_activity_at
            from subscription_checkouts sc
            where sc.user_id = u.id
          ) payments_last on true
          left join lateral (
            select jsonb_agg(
              jsonb_build_object(
                'id', payment.id,
                'planId', payment.plan_slug,
                'status', payment.status,
                'provider', payment.provider,
                'currency', payment.currency,
                'amountMinor', payment.amount_minor,
                'createdAt', payment.created_at
              )
              order by payment.created_at desc
            ) as items
            from (
              select sc.id, sc.plan_slug, sc.status, sc.provider, sc.currency, sc.amount_minor, sc.created_at
              from subscription_checkouts sc
              where sc.user_id = u.id
              order by sc.created_at desc
              limit 5
            ) payment
          ) payments on true
          left join lateral (
            select jsonb_agg(
              jsonb_build_object(
                'id', project.id,
                'name', project.name,
                'type', project.project_type,
                'status', project.status,
                'assetsCount', project.assets_count,
                'updatedAt', project.updated_at
              )
              order by project.updated_at desc
            ) as items
            from (
              select
                p.id,
                p.name,
                p.project_type,
                p.status,
                p.updated_at,
                (
                  select count(*)
                  from user_media_assets a
                  where a.project_id = p.id
                ) as assets_count
              from user_projects p
              where p.user_id = u.id
              order by p.updated_at desc
              limit 5
            ) project
          ) projects on true
          order by u.created_at desc
        `,
        [normalizedQuery]
      );

      return ok<AdminUserSearchResult>({
        query: normalizedQuery,
        users: result.rows.map(mapAdminUserRow),
        privacyNote:
          "Админ видит только метаданные, платежи, счетчики активности и названия проектов. Содержимое чатов, файлов и проектов не выводится.",
      });
    } catch {
      return ok<AdminUserSearchResult>({
        query: normalizedQuery,
        users: [],
        privacyNote:
          "Поиск пользователей не удалось загрузить из базы. Данные не подменяются локальными пользователями.",
      });
    }
  }

  async controlState() {
    try {
      await this.ensureControlSeeded();
      const [featureFlags, aiProviders, agentsResult, promotions, contentBlocks, auditLog] = await Promise.all([
        this.featureFlags(),
        this.aiProviderSettings(),
        this.agents.listAllAgents(),
        this.promotions(),
        this.contentBlocks(),
        this.auditLog(),
      ]);

      return ok<AdminControlState>({
        featureFlags,
        aiProviders,
        agents: agentsResult.ok ? agentsResult.value.map(mapAdminAgentRecord) : [],
        promotions,
        contentBlocks,
        integrationChecks: buildIntegrationChecks(),
        auditLog,
        policyMode: getProviderPolicyMode(),
        note: "Эти настройки хранятся в базе и позволяют менять поведение приложения без правки кода.",
      });
    } catch {
      return this.fallbackControlStateResult();
    }
  }

  async publishedContentBlocks(input: { placement: string; locale: string }) {
    try {
      await this.ensureControlSeeded();
      const contentBlocks = (await this.contentBlocks())
        .filter((block) => block.active && block.placement === input.placement && block.locale === input.locale)
        .map(toPublicContentBlock);

      return ok<PublicContentBlocks>({ contentBlocks });
    } catch {
      const updatedAt = new Date().toISOString();
      const contentBlocks = defaultContentBlocks()
        .filter((block) => block.active && block.placement === input.placement && block.locale === input.locale)
        .map((block) => toPublicContentBlock({ ...block, updatedAt }));

      return ok<PublicContentBlocks>({ contentBlocks });
    }
  }

  async aiBudget() {
    try {
      await this.ensureControlSeeded();
      const [aiProviders, usageByProvider] = await Promise.all([
        this.aiProviderSettings(),
        this.aiBudgetUsageByProvider(),
      ]);
      const providerRecords = aiProviders
        .filter((provider) => isAiBudgetProviderCode(provider.code))
        .map((provider) => buildAiBudgetProviderRecord(provider, usageByProvider.get(provider.code)));

      return ok<AdminAiBudgetState>(buildAiBudgetState(providerRecords));
    } catch {
      return ok<AdminAiBudgetState>(fallbackAiBudgetState());
    }
  }

  async updateFeatureFlag(input: {
    key: string;
    enabled?: boolean;
    label?: string;
    description?: string;
    audience?: string;
    rolloutPercent?: number;
    actorUserId?: string | null;
  }) {
    try {
      await this.ensureControlSeeded();
      const current = (await this.featureFlags()).find((flag) => flag.key === input.key);
      const next = {
        key: input.key,
        label: input.label ?? current?.label ?? input.key,
        description: input.description ?? current?.description ?? "",
        enabled: input.enabled ?? current?.enabled ?? false,
        audience: input.audience ?? current?.audience ?? "all",
        rolloutPercent: input.rolloutPercent ?? current?.rolloutPercent ?? 100,
      };

      await this.database.query(
        `
          insert into feature_flags (key, label, description, enabled, audience, rollout_percent, updated_by_user_id)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (key) do update set
            label = excluded.label,
            description = excluded.description,
            enabled = excluded.enabled,
            audience = excluded.audience,
            rollout_percent = excluded.rollout_percent,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = now()
        `,
        [next.key, next.label, next.description, next.enabled, next.audience, next.rolloutPercent, input.actorUserId ?? null]
      );
      await this.recordAudit(input.actorUserId, "feature_flag.updated", "feature_flag", input.key, {
        before: current ?? null,
        after: next,
      });
    } catch {
      return this.controlState();
    }

    return this.controlState();
  }

  async updateAiProvider(input: {
    code: string;
    enabled?: boolean;
    model?: string;
    trafficMode?: "primary" | "reserve" | "paused";
    actorUserId?: string | null;
  }) {
    try {
      await this.ensureControlSeeded();
      const current = (await this.aiProviderSettings()).find((provider) => provider.code === input.code);
      const configured = getConfiguredProviders().find((provider) => provider.code === input.code);
      const next = {
        code: input.code,
        name: configured?.name ?? current?.name ?? input.code,
        enabled: input.enabled ?? current?.enabled ?? Boolean(configured?.enabled),
        model: input.model ?? current?.model ?? defaultProviderModel(input.code),
        trafficMode: input.trafficMode ?? current?.trafficMode ?? "paused",
        modalities: configured?.modalities ?? current?.modalities ?? [],
      };

      await this.database.query(
        `
          insert into ai_provider_settings (provider_code, name, enabled, model, traffic_mode, modalities, updated_by_user_id)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (provider_code) do update set
            name = excluded.name,
            enabled = excluded.enabled,
            model = excluded.model,
            traffic_mode = excluded.traffic_mode,
            modalities = excluded.modalities,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = now()
        `,
        [next.code, next.name, next.enabled, next.model, next.trafficMode, next.modalities, input.actorUserId ?? null]
      );
      await this.recordAudit(input.actorUserId, "ai_provider.updated", "ai_provider", input.code, {
        before: current ?? null,
        after: next,
      });
    } catch {
      return this.controlState();
    }

    return this.controlState();
  }

  async updateAgent(input: { id: string; enabled?: boolean; actorUserId?: string | null }) {
    try {
      const currentResult = await this.agents.listAllAgents();
      const current = currentResult.ok ? currentResult.value.find((agent) => agent.id === input.id) : null;
      const nextEnabled = input.enabled ?? current?.enabled ?? false;
      const updateResult = await this.agents.updateAgentEnabled(input.id, nextEnabled);
      if (!updateResult.ok) return updateResult;

      await this.recordAudit(input.actorUserId, "agent.updated", "agent", input.id, {
        before: current ? mapAdminAgentRecord(current) : null,
        after: mapAdminAgentRecord(updateResult.value),
      });
    } catch {
      return this.controlState();
    }

    return this.controlState();
  }

  async updatePromotion(input: {
    slug: string;
    title?: string;
    body?: string;
    placement?: string;
    audience?: string;
    active?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    priority?: number;
    actorUserId?: string | null;
  }) {
    try {
      await this.ensureControlSeeded();
      const current = (await this.promotions()).find((promotion) => promotion.slug === input.slug);
      const next = {
        slug: input.slug,
        title: input.title ?? current?.title ?? input.slug,
        body: input.body ?? current?.body ?? "",
        placement: input.placement ?? current?.placement ?? "global",
        audience: input.audience ?? current?.audience ?? "all",
        active: input.active ?? current?.active ?? false,
        startsAt: input.startsAt === undefined ? current?.startsAt ?? null : input.startsAt,
        endsAt: input.endsAt === undefined ? current?.endsAt ?? null : input.endsAt,
        priority: input.priority ?? current?.priority ?? 100,
      };

      await this.database.query(
        `
          insert into promotions (slug, title, body, placement, audience, active, starts_at, ends_at, priority, updated_by_user_id)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          on conflict (slug) do update set
            title = excluded.title,
            body = excluded.body,
            placement = excluded.placement,
            audience = excluded.audience,
            active = excluded.active,
            starts_at = excluded.starts_at,
            ends_at = excluded.ends_at,
            priority = excluded.priority,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = now()
        `,
        [
          next.slug,
          next.title,
          next.body,
          next.placement,
          next.audience,
          next.active,
          next.startsAt,
          next.endsAt,
          next.priority,
          input.actorUserId ?? null,
        ]
      );
      await this.recordAudit(input.actorUserId, "promotion.updated", "promotion", input.slug, {
        before: current ?? null,
        after: next,
      });
    } catch {
      return this.controlState();
    }

    return this.controlState();
  }

  async updateContentBlock(input: {
    key: string;
    locale?: string;
    title?: string;
    body?: string;
    placement?: string;
    active?: boolean;
    actorUserId?: string | null;
  }) {
    const locale = input.locale ?? "ru";
    try {
      await this.ensureControlSeeded();
      const current = (await this.contentBlocks()).find((block) => block.key === input.key && block.locale === locale);
      const next = {
        key: input.key,
        locale,
        title: input.title ?? current?.title ?? "",
        body: input.body ?? current?.body ?? "",
        placement: input.placement ?? current?.placement ?? "app",
        active: input.active ?? current?.active ?? true,
      };

      await this.database.query(
        `
          insert into content_blocks (key, locale, title, body, placement, active, updated_by_user_id)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (key, locale) do update set
            title = excluded.title,
            body = excluded.body,
            placement = excluded.placement,
            active = excluded.active,
            updated_by_user_id = excluded.updated_by_user_id,
            updated_at = now()
        `,
        [next.key, next.locale, next.title, next.body, next.placement, next.active, input.actorUserId ?? null]
      );
      await this.recordAudit(input.actorUserId, "content_block.updated", "content_block", `${input.key}:${locale}`, {
        before: current ?? null,
        after: next,
      });
    } catch {
      return this.controlState();
    }

    return this.controlState();
  }

  private async ensureControlSeeded() {
    if (this.controlSeeded) return;

    for (const flag of defaultFeatureFlags()) {
      await this.database.query(
        `
          insert into feature_flags (key, label, description, enabled, audience, rollout_percent)
          values ($1, $2, $3, $4, $5, $6)
          on conflict (key) do nothing
        `,
        [flag.key, flag.label, flag.description, flag.enabled, flag.audience, flag.rolloutPercent]
      );
    }

    for (const provider of getConfiguredProviders()) {
      await this.database.query(
        `
          insert into ai_provider_settings (provider_code, name, enabled, model, traffic_mode, modalities, metadata)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          on conflict (provider_code) do update set
            name = excluded.name,
            modalities = excluded.modalities,
            metadata = ai_provider_settings.metadata || excluded.metadata,
            updated_at = now()
        `,
        [
          provider.code,
          provider.name,
          provider.enabled,
          provider.modelByModality.text ?? defaultProviderModel(provider.code),
          provider.enabled ? "primary" : "paused",
          provider.modalities,
          JSON.stringify({
            backendConfigured: provider.enabled,
            reason: provider.reason,
          }),
        ]
      );
    }

    for (const promotion of defaultPromotions()) {
      await this.database.query(
        `
          insert into promotions (slug, title, body, placement, audience, active, priority)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (slug) do nothing
        `,
        [
          promotion.slug,
          promotion.title,
          promotion.body,
          promotion.placement,
          promotion.audience,
          promotion.active,
          promotion.priority,
        ]
      );
    }

    for (const block of defaultContentBlocks()) {
      await this.database.query(
        `
          insert into content_blocks (key, locale, title, body, placement, active)
          values ($1, $2, $3, $4, $5, $6)
          on conflict (key, locale) do nothing
        `,
        [block.key, block.locale, block.title, block.body, block.placement, block.active]
      );
    }

    this.controlSeeded = true;
  }

  private async featureFlags() {
    const result = await this.database.query<FeatureFlagRow>(
      `
        select key, label, description, enabled, audience, rollout_percent, updated_at
        from feature_flags
        order by key asc
      `
    );

    return result.rows.map(mapFeatureFlagRow);
  }

  private async aiProviderSettings() {
    const configuredProviders = new Map<string, ReturnType<typeof getConfiguredProviders>[number]>(
      getConfiguredProviders().map((provider) => [provider.code, provider])
    );
    const result = await this.database.query<AiProviderSettingRow>(
      `
        select provider_code, name, enabled, model, traffic_mode, modalities, metadata, updated_at
        from ai_provider_settings
        order by provider_code asc
      `
    );

    return result.rows.map((row) => mapAiProviderSettingRow(row, configuredProviders.get(row.provider_code)));
  }

  private async aiBudgetUsageByProvider() {
    const usageByProvider = new Map<string, AiBudgetUsageRow>();

    try {
      const result = await this.database.query<AiBudgetUsageRow>(
        `
          with answer_usage as (
            select
              lower(provider) as provider,
              coalesce(
                case
                  when provider_usage ->> 'finalCredits' ~ '^[0-9]+(\\.[0-9]+)?$'
                    then (provider_usage ->> 'finalCredits')::numeric
                end,
                case
                  when route_metadata ->> 'estimatedCredits' ~ '^[0-9]+(\\.[0-9]+)?$'
                    then (route_metadata ->> 'estimatedCredits')::numeric
                end,
                0
              ) as credits,
              created_at
            from message_answer_variants
            where lower(provider) = any($1::text[])
          ),
          event_usage as (
            select
              lower(ap.code) as provider,
              ue.charged_credits::numeric as credits,
              ue.created_at
            from usage_events ue
            join ai_providers ap on ap.id = ue.provider_id
            where lower(ap.code) = any($1::text[])
          ),
          event_count as (
            select count(*)::int as value
            from event_usage
          ),
          source_usage as (
            select *
            from event_usage
            where (select value from event_count) > 0
            union all
            select *
            from answer_usage
            where (select value from event_count) = 0
          )
          select
            provider,
            count(*) filter (where created_at >= now() - interval '24 hours')::text as requests_24h,
            count(*) filter (where created_at >= now() - interval '7 days')::text as requests_7d,
            count(*) filter (where created_at >= now() - interval '30 days')::text as requests_30d,
            coalesce(sum(credits) filter (where created_at >= now() - interval '24 hours'), 0)::text as credits_24h,
            coalesce(sum(credits) filter (where created_at >= now() - interval '7 days'), 0)::text as credits_7d,
            coalesce(sum(credits) filter (where created_at >= now() - interval '30 days'), 0)::text as credits_30d,
            max(created_at) as last_activity_at
          from source_usage
          group by provider
        `,
        [[...aiBudgetProviderCodes]]
      );

      for (const row of result.rows) {
        if (row.provider) usageByProvider.set(row.provider, row);
      }
    } catch {
      return usageByProvider;
    }

    return usageByProvider;
  }

  private async promotions() {
    const result = await this.database.query<PromotionRow>(
      `
        select slug, title, body, placement, audience, active, starts_at, ends_at, priority, updated_at
        from promotions
        order by priority asc, created_at asc
      `
    );

    return result.rows.map(mapPromotionRow);
  }

  private async contentBlocks() {
    const result = await this.database.query<ContentBlockRow>(
      `
        select key, locale, title, body, placement, active, updated_at
        from content_blocks
        order by placement asc, key asc, locale asc
      `
    );

    return result.rows.map(mapContentBlockRow);
  }

  private async auditLog() {
    const result = await this.database.query<AuditLogRow>(
      `
        select action, entity_type, entity_id, created_at
        from audit_logs
        where action like 'feature_flag.%'
           or action like 'ai_provider.%'
           or action like 'agent.%'
           or action like 'promotion.%'
           or action like 'content_block.%'
        order by created_at desc
        limit 20
      `
    );

    return result.rows.map(mapAuditLogRow);
  }

  private async recordAudit(
    actorUserId: string | null | undefined,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>
  ) {
    try {
      await this.database.query(
        `
          insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
          values ($1, $2, $3, $4, $5::jsonb)
        `,
        [actorUserId ?? null, action, entityType, entityId, JSON.stringify(metadata)]
      );
    } catch {
      return undefined;
    }
  }

  private async count(table: string, where?: string) {
    try {
      const result = await this.database.query<CountRow>(
        `select count(*)::text as count from ${table}${where ? ` where ${where}` : ""}`
      );
      return Number(result.rows[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  private async sum(table: string, column: string) {
    try {
      const result = await this.database.query<SumRow>(`select coalesce(sum(${column}), 0)::text as value from ${table}`);
      return Number(result.rows[0]?.value ?? 0);
    } catch {
      return 0;
    }
  }

  private async pricingState(): Promise<AdminPricingState> {
    try {
      await this.ensurePricingSeeded();
      const result = await this.database.query<PlanPriceRow>(
        `
          select
            p.slug,
            p.name,
            p.monthly_credits,
            p.context_tokens,
            p.description,
            p.enabled,
            pp.country_code,
            pp.provider,
            pp.currency,
            pp.amount_minor,
            pp.price_source
          from plans p
          join plan_prices pp on pp.plan_id = p.id
          where p.enabled = true
          order by p.sort_order asc, pp.country_code asc
        `
      );
      const exchangeRates = await this.exchangeRates();

      if (result.rows.length > 0) {
        const plans = new Map<PlanId, AdminPricingState["plans"][number]>();
        for (const row of result.rows) {
          if (!isPlanId(row.slug) || !isCountry(row.country_code)) continue;
          const existing = plans.get(row.slug) ?? {
            id: row.slug,
            name: row.name,
            monthlyCredits: Number(row.monthly_credits),
            contextTokens: Number(row.context_tokens),
            description: row.description,
            enabled: row.enabled,
            prices: [],
          };

          existing.prices.push({
            country: row.country_code,
            provider: row.provider === "kaspi" ? "kaspi" : "yookassa",
            currency: row.currency,
            amountMinor: Number(row.amount_minor),
            priceSource: row.price_source === "admin_fixed_rate" ? "admin_fixed_rate" : "mashagpt_benchmark_draft",
          });
          plans.set(row.slug, existing);
        }

        return {
          exchangeRates,
          plans: [...plans.values()],
        };
      }

      return {
        exchangeRates,
        plans: [],
      };
    } catch {
      return {
        exchangeRates: await this.exchangeRates(),
        plans: [],
      };
    }
  }

  private async ensurePricingSeeded() {
    if (this.pricingSeeded) return;

    for (const plan of subscriptionPlans) {
      await this.database.query(
        `
          insert into plans (slug, name, monthly_credits, context_tokens, description, enabled, sort_order)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (slug) do update set
            name = excluded.name,
            monthly_credits = excluded.monthly_credits,
            context_tokens = excluded.context_tokens,
            description = excluded.description,
            enabled = excluded.enabled,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [plan.id, plan.name, plan.monthlyCredits, plan.contextTokens, plan.description, plan.enabled, sortOrder(plan.id)]
      );

      for (const planPrice of plan.prices) {
        await this.database.query(
          `
            insert into plan_prices (plan_id, country_code, provider, currency, amount_minor, price_source)
            select id, $2, $3, $4, $5, $6
            from plans
            where slug = $1
            on conflict (plan_id, country_code) do update set
              provider = excluded.provider,
              currency = excluded.currency,
              amount_minor = case
                when plan_prices.price_source = 'admin_fixed_rate' then plan_prices.amount_minor
                else excluded.amount_minor
              end,
              price_source = case
                when plan_prices.price_source = 'admin_fixed_rate' then plan_prices.price_source
                else excluded.price_source
              end,
              updated_at = now()
          `,
          [
            plan.id,
            planPrice.country,
            planPrice.provider,
            planPrice.currency,
            planPrice.amountMinor,
            planPrice.priceSource,
          ]
        );
      }
    }

    this.pricingSeeded = true;
  }

  private async paymentReport(): Promise<AdminPaymentReport> {
    const providers = defaultPaymentProviders();
    try {
      const result = await this.database.query<PaymentReportRow>(
        `
          select
            provider,
            currency,
            status,
            count(*)::text as count,
            coalesce(sum(amount_minor), 0)::text as amount_minor,
            count(*) filter (where credits_granted = true)::text as credits_granted_count
          from subscription_checkouts
          where provider in ('kaspi', 'yookassa')
          group by provider, currency, status
        `
      );

      for (const row of result.rows) {
        if (row.provider !== "kaspi" && row.provider !== "yookassa") continue;
        const report = providers.find((candidate) => candidate.provider === row.provider);
        if (!report) continue;

        const stat = {
          count: Number(row.count ?? 0),
          amountMinor: Number(row.amount_minor ?? 0),
        };

        report.total.count += stat.count;
        report.total.amountMinor += stat.amountMinor;
        report.creditsGrantedCount += Number(row.credits_granted_count ?? 0);

        if (row.status === "completed") {
          report.paid.count += stat.count;
          report.paid.amountMinor += stat.amountMinor;
        } else if (row.status === "pending") {
          report.pending.count += stat.count;
          report.pending.amountMinor += stat.amountMinor;
        } else if (row.status === "cancelled") {
          report.cancelled.count += stat.count;
          report.cancelled.amountMinor += stat.amountMinor;
        } else if (row.status === "failed") {
          report.failed.count += stat.count;
          report.failed.amountMinor += stat.amountMinor;
        }
      }
    } catch {
      return fallbackPaymentReport();
    }

    return {
      providers,
      note: "Оплачено считается только по completed checkout. Pending, cancelled и failed не попадают в оплаченные суммы.",
    };
  }

  private async exchangeRates(): Promise<AdminPricingState["exchangeRates"]> {
    const now = Date.now();
    if (this.exchangeRateCache && this.exchangeRateCache.expiresAt > now) {
      return this.exchangeRateCache.rates;
    }

    try {
      const [cbrXml, nbkXml] = await Promise.all([fetchText(cbrDailyUrl), fetchText(nbkDailyUrl)]);
      const fetchedAt = new Date().toISOString();
      const nextUpdateAt = new Date(now + exchangeRateTtlMs).toISOString();
      const cbrDate = parseCbrDate(cbrXml) ?? fetchedAt;
      const nbkDate = parseNbkDate(nbkXml) ?? fetchedAt;
      const usdRub = parseCbrCurrencyRate(cbrXml, "USD");
      const usdKzt = parseNbkCurrencyRate(nbkXml, "USD");
      const rubKzt = parseNbkCurrencyRate(nbkXml, "RUB");

      if (!usdRub || !usdKzt || !rubKzt) {
        throw new Error("Exchange rate source response is incomplete.");
      }

      const rates: AdminPricingState["exchangeRates"] = [
        {
          pair: "USD/RUB",
          value: usdRub,
          source: "cbr",
          sourceName: "ЦБ РФ",
          effectiveDate: cbrDate,
          fetchedAt,
          nextUpdateAt,
          stale: false,
          note: "Официальный дневной курс доллара к рублю.",
        },
        {
          pair: "USD/KZT",
          value: usdKzt,
          source: "nbk",
          sourceName: "Нацбанк Казахстана",
          effectiveDate: nbkDate,
          fetchedAt,
          nextUpdateAt,
          stale: false,
          note: "Официальный дневной курс доллара к тенге.",
        },
        {
          pair: "RUB/KZT",
          value: rubKzt,
          source: "nbk",
          sourceName: "Нацбанк Казахстана",
          effectiveDate: nbkDate,
          fetchedAt,
          nextUpdateAt,
          stale: false,
          note: "Официальный дневной курс рубля к тенге.",
        },
      ];

      this.exchangeRateCache = {
        expiresAt: now + exchangeRateTtlMs,
        rates,
      };

      return rates;
    } catch {
      if (this.exchangeRateCache) {
        const staleRates = this.exchangeRateCache.rates.map((rate) => ({
          ...rate,
          stale: true,
          nextUpdateAt: new Date(now + 60 * 60 * 1000).toISOString(),
          note: `${rate.note} Источник временно недоступен, показан последний успешно загруженный курс.`,
        }));
        this.exchangeRateCache = {
          expiresAt: now + 60 * 60 * 1000,
          rates: staleRates,
        };
        return staleRates;
      }

      return [];
    }
  }

  private async fallbackControlStateResult() {
    const agentsResult = await this.agents.listAllAgents().catch(() => null);
    return ok<AdminControlState>(fallbackControlState(agentsResult?.ok ? agentsResult.value : undefined));
  }
}

function fallbackControlState(agents?: AgentRecord[]): AdminControlState {
  const configuredProviders = new Map(getConfiguredProviders().map((provider) => [provider.code, provider]));
  const fallbackAgents =
    agents?.map(mapAdminAgentRecord) ??
    seedAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      category: agent.category,
      description: agent.description,
      enabled: true,
      inputTypes: agent.inputTypes,
      outputTypes: agent.outputTypes,
      defaultModel: agent.defaultModel,
      fallbackModels: agent.fallbackModels ?? [],
      priceMultiplier: agent.priceMultiplier ?? 1,
    }));

  return {
    featureFlags: defaultFeatureFlags(),
    aiProviders: getConfiguredProviders().map((provider) => ({
      code: provider.code,
      name: provider.name,
      enabled: provider.enabled,
      backendConfigured: provider.enabled,
      model: provider.modelByModality.text ?? defaultProviderModel(provider.code),
      trafficMode: provider.enabled ? "primary" : "paused",
      modalities: provider.modalities,
      reason: provider.reason,
      updatedAt: new Date().toISOString(),
    })),
    agents: fallbackAgents,
    promotions: defaultPromotions().map((promotion) => ({
      ...promotion,
      startsAt: null,
      endsAt: null,
      updatedAt: new Date().toISOString(),
    })),
    contentBlocks: defaultContentBlocks().map((block) => ({
      ...block,
      updatedAt: new Date().toISOString(),
    })),
    integrationChecks: buildIntegrationChecks(),
    auditLog: [],
    policyMode: getProviderPolicyMode(),
    note: configuredProviders.size > 0
      ? "API управления пока работает в fallback-режиме без записи в базу."
      : "API управления пока не подключен.",
  };
}

function buildAiBudgetState(providers: AdminAiBudgetProviderRecord[]): AdminAiBudgetState {
  const budgetUsd = sumNullable(providers.map((provider) => provider.budgetUsd));
  const balanceUsd = sumNullable(providers.map((provider) => provider.balanceUsd));
  const estimatedCreditsRemaining =
    balanceUsd === null ? null : Math.max(0, Math.floor(balanceUsd * config.AI_CREDITS_PER_USD));
  const spentCredits30d = providers.reduce((sum, provider) => sum + provider.spentCredits30d, 0);
  const spentUsd30d = creditsToUsd(spentCredits30d);
  const avgUsdPerDay30d = spentUsd30d / 30;
  const daysRemaining =
    balanceUsd !== null && avgUsdPerDay30d > 0 ? roundMetric(balanceUsd / avgUsdPerDay30d, 1) : null;

  return {
    providers,
    totals: {
      budgetUsd,
      balanceUsd,
      estimatedCreditsRemaining,
      spentCredits30d,
      spentUsd30d,
      avgUsdPerDay30d,
      daysRemaining,
      activeProviders: providers.filter((provider) => provider.enabled && provider.trafficMode !== "paused").length,
      configuredProviders: providers.filter((provider) => provider.backendConfigured).length,
    },
    creditsPerUsd: config.AI_CREDITS_PER_USD,
    generatedAt: new Date().toISOString(),
    note:
      "Остаток берется из *_BALANCE_USD, если переменная задана. Если задан только *_BUDGET_USD, баланс считается как бюджет минус расход за 30 дней. Расход считается по сохраненным ответам и генерациям в базе, внешние кабинеты провайдеров не опрашиваются.",
  };
}

function buildAiBudgetProviderRecord(
  provider: AdminAiProviderSettingRecord,
  usageRow?: AiBudgetUsageRow
): AdminAiBudgetProviderRecord {
  const code = isAiBudgetProviderCode(provider.code) ? provider.code : "openai";
  const budgetUsd = providerBudgetUsd(code);
  const spentCredits24h = rowNumber(usageRow?.credits_24h);
  const spentCredits7d = rowNumber(usageRow?.credits_7d);
  const spentCredits30d = rowNumber(usageRow?.credits_30d);
  const spentUsd30d = creditsToUsd(spentCredits30d);
  const explicitBalanceUsd = providerBalanceUsd(code);
  const balanceUsd =
    explicitBalanceUsd ?? (budgetUsd === null ? null : Math.max(0, roundMetric(budgetUsd - spentUsd30d, 2)));
  const balanceSource =
    explicitBalanceUsd !== null ? "manual_env" : budgetUsd !== null ? "estimated_from_budget" : "not_configured";
  const avgCreditsPerDay30d = spentCredits30d / 30;
  const avgUsdPerDay30d = spentUsd30d / 30;
  const daysRemaining =
    balanceUsd !== null && avgUsdPerDay30d > 0 ? roundMetric(balanceUsd / avgUsdPerDay30d, 1) : null;
  const status = aiBudgetStatus(provider, balanceUsd, daysRemaining);

  return {
    code: provider.code,
    name: provider.name,
    enabled: provider.enabled,
    backendConfigured: provider.backendConfigured,
    trafficMode: provider.trafficMode,
    model: provider.model,
    modalities: provider.modalities,
    budgetUsd,
    balanceUsd,
    balanceSource,
    estimatedCreditsRemaining:
      balanceUsd === null ? null : Math.max(0, Math.floor(balanceUsd * config.AI_CREDITS_PER_USD)),
    spentCredits24h,
    spentCredits7d,
    spentCredits30d,
    spentUsd30d,
    requests24h: rowNumber(usageRow?.requests_24h),
    requests7d: rowNumber(usageRow?.requests_7d),
    requests30d: rowNumber(usageRow?.requests_30d),
    avgCreditsPerDay30d,
    avgUsdPerDay30d,
    daysRemaining,
    status,
    refillHint: aiBudgetRefillHint(code, provider, balanceUsd, daysRemaining, spentCredits30d),
    lastActivityAt: usageRow?.last_activity_at ? toIsoString(usageRow.last_activity_at) : null,
  };
}

function fallbackAiBudgetState(): AdminAiBudgetState {
  const providers = getConfiguredProviders()
    .filter((provider) => isAiBudgetProviderCode(provider.code))
    .map((provider) =>
      buildAiBudgetProviderRecord({
        code: provider.code,
        name: provider.name,
        enabled: provider.enabled,
        backendConfigured: provider.enabled,
        model: provider.modelByModality.text ?? defaultProviderModel(provider.code),
        trafficMode: provider.enabled ? "primary" : "paused",
        modalities: provider.modalities,
        reason: provider.reason,
        updatedAt: new Date().toISOString(),
      })
    );

  return buildAiBudgetState(providers);
}

function buildIntegrationChecks(): AdminIntegrationCheckRecord[] {
  const smtpConfigured = Boolean(
    config.SMTP_BZ_API_KEY || (config.SMTP_HOST && config.SMTP_USERNAME && config.SMTP_PASSWORD)
  );
  const metrikaId = process.env.VITE_YANDEX_METRIKA_ID?.trim() || process.env.YANDEX_METRIKA_ID?.trim();
  const yandexVerification =
    process.env.VITE_YANDEX_VERIFICATION_CODE?.trim() || process.env.YANDEX_VERIFICATION_CODE?.trim();

  return [
    integrationCheck({
      key: "geo.country",
      category: "Гео",
      label: "Определение страны по IP",
      status: "ok",
      configured: true,
      detail: "API читает country headers от Cloudflare, Vercel, CloudFront и reverse proxy.",
      action: "На проде проверьте, что proxy передает cf-ipcountry или x-vercel-ip-country.",
    }),
    integrationCheck({
      key: "oauth.google",
      category: "Вход",
      label: "Google OAuth",
      status: config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET ? "ok" : "missing",
      configured: Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
      detail: "Для России Google отключается политикой, для других стран нужен OAuth client.",
      action: "Добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в Render.",
    }),
    integrationCheck({
      key: "oauth.yandex",
      category: "Вход",
      label: "Yandex ID",
      status: config.YANDEX_CLIENT_ID && config.YANDEX_CLIENT_SECRET ? "ok" : "missing",
      configured: Boolean(config.YANDEX_CLIENT_ID && config.YANDEX_CLIENT_SECRET),
      detail: "Быстрый вход для пользователей из РФ подключается через Yandex OAuth.",
      action: "Добавьте YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET в Render.",
    }),
    integrationCheck({
      key: "oauth.vk",
      category: "Вход",
      label: "VK ID / Mail.ru через VK ID",
      status: config.VK_CLIENT_ID && config.VK_CLIENT_SECRET ? "ok" : "missing",
      configured: Boolean(config.VK_CLIENT_ID && config.VK_CLIENT_SECRET),
      detail: "VK ID используется также для кнопки Mail.ru через VK ID.",
      action: "Добавьте VK_CLIENT_ID и VK_CLIENT_SECRET в Render.",
    }),
    integrationCheck({
      key: "oauth.sber",
      category: "Вход",
      label: "Sber ID",
      status: "manual",
      configured: false,
      detail: "В интерфейсе Sber ID отмечен как скоро; backend-провайдер Sber еще не подключен.",
      action: "Нужны доступ к Sber ID, client id/secret, redirect URL и отдельная реализация OAuth.",
    }),
    integrationCheck({
      key: "mail.transactional",
      category: "Почта",
      label: "Письма регистрации и оплаты",
      status: smtpConfigured ? "ok" : "missing",
      configured: smtpConfigured,
      detail: "Транзакционные письма используют SMTP.BZ или обычный SMTP.",
      action: "Добавьте SMTP_BZ_API_KEY или SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD.",
    }),
    integrationCheck({
      key: "mail.lifecycle",
      category: "Почта",
      label: "Напоминания 1/3 дня и окончание тарифа",
      status: smtpConfigured && config.LIFECYCLE_NOTIFICATIONS_TOKEN ? "ok" : smtpConfigured ? "attention" : "missing",
      configured: smtpConfigured && Boolean(config.LIFECYCLE_NOTIFICATIONS_TOKEN),
      detail: "Маршрут /notifications/lifecycle/run готов; для продакшена нужен секрет и cron.",
      action: "Задайте LIFECYCLE_NOTIFICATIONS_TOKEN и cron-запрос раз в день.",
    }),
    integrationCheck({
      key: "payment.kaspi",
      category: "Оплата",
      label: "Kaspi",
      status: config.KASPI_CHECKOUT_URL && config.KASPI_API_TOKEN ? "ok" : "missing",
      configured: Boolean(config.KASPI_CHECKOUT_URL && config.KASPI_API_TOKEN),
      detail: "Kaspi используется для Казахстана.",
      action: "Добавьте KASPI_CHECKOUT_URL и KASPI_API_TOKEN.",
    }),
    integrationCheck({
      key: "payment.yookassa",
      category: "Оплата",
      label: "YooKassa",
      status: config.YOOKASSA_SHOP_ID && config.YOOKASSA_SECRET_KEY ? "ok" : "missing",
      configured: Boolean(config.YOOKASSA_SHOP_ID && config.YOOKASSA_SECRET_KEY),
      detail: "YooKassa используется для России и требует email для чеков.",
      action: "Добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY.",
    }),
    integrationCheck({
      key: "analytics.yandex",
      category: "Аналитика",
      label: "Яндекс Метрика и Вебмастер",
      status: metrikaId && yandexVerification ? "ok" : metrikaId || yandexVerification ? "attention" : "missing",
      configured: Boolean(metrikaId && yandexVerification),
      detail: "Frontend умеет вставлять Метрику и yandex-verification из env.",
      action: "Добавьте VITE_YANDEX_METRIKA_ID и VITE_YANDEX_VERIFICATION_CODE при сборке web.",
    }),
    integrationCheck({
      key: "seo.assets",
      category: "SEO",
      label: "Favicon, robots, sitemap",
      status: "ok",
      configured: true,
      detail: "В web/public есть favicon, manifest, robots.txt и sitemap.xml.",
      action: "После деплоя отправьте sitemap.xml в Яндекс.Вебмастер вручную.",
    }),
    integrationCheck({
      key: "media.openai",
      category: "Медиа",
      label: "OpenAI текст/изображения/голос",
      status: config.OPENAI_API_KEY ? "ok" : "missing",
      configured: Boolean(config.OPENAI_API_KEY),
      detail: "OpenAI включается только при наличии OPENAI_API_KEY.",
      action: "Добавьте OPENAI_API_KEY и при необходимости OPENAI_IMAGE_MODEL, OPENAI_VOICE_MODEL.",
    }),
    integrationCheck({
      key: "media.gemini",
      category: "Медиа",
      label: "Gemini изображения/видео/музыка",
      status: config.GOOGLE_AI_API_KEY ? "ok" : "missing",
      configured: Boolean(config.GOOGLE_AI_API_KEY),
      detail: "Старые placeholder-модели нормализуются в рабочие дефолты Gemini.",
      action: "Добавьте GOOGLE_AI_API_KEY и проверьте доступность нужных моделей в кабинете Google AI.",
    }),
    integrationCheck({
      key: "media.heygen",
      category: "Медиа",
      label: "HeyGen аватар-видео",
      status: config.HEYGEN_API_KEY ? "ok" : "missing",
      configured: Boolean(config.HEYGEN_API_KEY),
      detail: "Аватар-видео создается через HeyGen Video Agent.",
      action: "Добавьте HEYGEN_API_KEY и при необходимости HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID.",
    }),
  ];
}

function integrationCheck(input: AdminIntegrationCheckRecord): AdminIntegrationCheckRecord {
  return input;
}

function aiBudgetStatus(
  provider: Pick<AdminAiProviderSettingRecord, "backendConfigured" | "enabled" | "trafficMode">,
  balanceUsd: number | null,
  daysRemaining: number | null
): AdminAiBudgetProviderStatus {
  if (!provider.backendConfigured) return "risk";
  if (!provider.enabled || provider.trafficMode === "paused") return "attention";
  if (balanceUsd === null) return "unknown";
  if (balanceUsd <= 5 || (daysRemaining !== null && daysRemaining <= 3)) return "risk";
  if (balanceUsd <= 15 || (daysRemaining !== null && daysRemaining <= 7)) return "attention";
  return "ok";
}

function aiBudgetRefillHint(
  code: AiBudgetProviderCode,
  provider: Pick<AdminAiProviderSettingRecord, "backendConfigured" | "enabled" | "trafficMode">,
  balanceUsd: number | null,
  daysRemaining: number | null,
  spentCredits30d: number
) {
  const envNames = providerBudgetEnvNames(code);
  if (!provider.backendConfigured) return "Сначала добавьте API key провайдера и сделайте деплой backend.";
  if (!provider.enabled || provider.trafficMode === "paused") return "Провайдер сейчас не принимает трафик. Проверьте вкладку запуска.";
  if (balanceUsd === null) return `Заполните ${envNames.balance} или ${envNames.budget} в Render Environment.`;
  if (spentCredits30d <= 0) return "Расхода за 30 дней пока нет. Баланс контролируется, но прогноз дней появится после первых запросов.";
  if (daysRemaining !== null && daysRemaining <= 3) return "Пополнить сейчас: остаток меньше трех дней при текущем темпе.";
  if (daysRemaining !== null && daysRemaining <= 7) return "Запланируйте пополнение: запас меньше недели.";
  return "Запас выглядит нормальным при текущем темпе расхода.";
}

function providerBudgetUsd(code: AiBudgetProviderCode) {
  if (code === "openai") return nullableNumber(config.OPENAI_BUDGET_USD);
  if (code === "anthropic") return nullableNumber(config.ANTHROPIC_BUDGET_USD);
  return nullableNumber(config.GEMINI_BUDGET_USD);
}

function providerBalanceUsd(code: AiBudgetProviderCode) {
  if (code === "openai") return nullableNumber(config.OPENAI_BALANCE_USD);
  if (code === "anthropic") return nullableNumber(config.ANTHROPIC_BALANCE_USD);
  return nullableNumber(config.GEMINI_BALANCE_USD);
}

function providerBudgetEnvNames(code: AiBudgetProviderCode) {
  if (code === "openai") return { budget: "OPENAI_BUDGET_USD", balance: "OPENAI_BALANCE_USD" };
  if (code === "anthropic") return { budget: "ANTHROPIC_BUDGET_USD", balance: "ANTHROPIC_BALANCE_USD" };
  return { budget: "GEMINI_BUDGET_USD", balance: "GEMINI_BALANCE_USD" };
}

function creditsToUsd(value: number) {
  return roundMetric(value / config.AI_CREDITS_PER_USD, 2);
}

function isAiBudgetProviderCode(value: string): value is AiBudgetProviderCode {
  return aiBudgetProviderCodes.includes(value as AiBudgetProviderCode);
}

function nullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rowNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundMetric(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function sumNullable(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (numericValues.length === 0) return null;
  return roundMetric(numericValues.reduce((sum, value) => sum + value, 0), 2);
}

function defaultFeatureFlags(): AdminFeatureFlagRecord[] {
  const updatedAt = new Date().toISOString();
  return [
    {
      key: "auth.registration",
      label: "Регистрация",
      description: "Показывать регистрацию после гостевых запросов и разрешать создание аккаунтов.",
      enabled: true,
      audience: "guests",
      rolloutPercent: 100,
      updatedAt,
    },
    {
      key: "auth.google",
      label: "Google вход",
      description: "Разрешить вход через Google, если OAuth ключи заданы на backend.",
      enabled: false,
      audience: "all",
      rolloutPercent: 100,
      updatedAt,
    },
    {
      key: "auth.vk",
      label: "VK вход",
      description: "Разрешить вход через VK, если OAuth ключи заданы на backend.",
      enabled: false,
      audience: "ru",
      rolloutPercent: 100,
      updatedAt,
    },
    {
      key: "chat.files",
      label: "Файлы в чате",
      description: "Разрешить загрузку текстовых файлов в чат.",
      enabled: true,
      audience: "all",
      rolloutPercent: 100,
      updatedAt,
    },
    {
      key: "chat.voice",
      label: "Голосовой ввод",
      description: "Разрешить голосовой ввод в чате через браузер.",
      enabled: true,
      audience: "all",
      rolloutPercent: 100,
      updatedAt,
    },
    {
      key: "business.cabinet",
      label: "Business кабинет",
      description: "Показывать бизнес-кабинет, роли, CRM и идеи.",
      enabled: true,
      audience: "business",
      rolloutPercent: 100,
      updatedAt,
    },
  ];
}

function defaultPromotions(): Array<Omit<AdminPromotionRecord, "startsAt" | "endsAt" | "updatedAt">> {
  return [
    {
      slug: "launch-offer",
      title: "Стартовый месяц nomduchat Pro",
      body: "Короткое предложение на тарифы для пользователей, которые дошли до баланса.",
      placement: "balance",
      audience: "new_users",
      active: true,
      priority: 10,
    },
    {
      slug: "business-demo",
      title: "Демо Business кабинета",
      body: "Аудит обращений и схема AI-бота перед подключением Business.",
      placement: "business",
      audience: "business_interest",
      active: false,
      priority: 20,
    },
  ];
}

function defaultContentBlocks(): Array<Omit<AdminContentBlockRecord, "updatedAt">> {
  return [
    {
      key: "home.hero",
      locale: "ru",
      title: "nomduchat",
      body: "Единый кабинет для общения с 40+ AI-моделями, работы с файлами, бизнес-агентами и памятью.",
      placement: "home",
      active: true,
    },
    {
      key: "workspace.home.article.images",
      locale: "ru",
      title: "Как подготовить изображение, которое выглядит дороже",
      body: "До генерации определите формат, главный объект и свет. Это помогает собрать чистую композицию без случайных деталей.\n\nДобавьте референс, если важно сохранить форму, материал или характер сцены. В описании оставьте только те признаки, которые действительно должны попасть в кадр.\n\nПеред запуском проверьте размер и ракурс: они сильнее всего влияют на то, как изображение будет выглядеть в публикации.",
      placement: "workspace.home.articles",
      active: true,
    },
    {
      key: "workspace.home.article.video",
      locale: "ru",
      title: "Что указать перед генерацией короткого видео",
      body: "Стартовый кадр задаёт композицию, героя и свет будущего ролика. Выберите его до того, как описывать движение.\n\nДля короткой сцены достаточно одного действия и одного движения камеры. Чем меньше конфликтующих команд, тем стабильнее сохраняются детали.\n\nЗаранее задайте длительность, формат и качество под площадку, где будет опубликовано видео.",
      placement: "workspace.home.articles",
      active: true,
    },
    {
      key: "workspace.home.article.humanizer",
      locale: "ru",
      title: "Как убрать сухой AI-тон из текста",
      body: "Сначала сохраните факты и основную мысль, затем уберите канцелярит и повторяющиеся выводы. Текст станет короче, но не потеряет смысл.\n\nРазбейте длинные предложения и оставьте естественные связки между абзацами. Не добавляйте эмоции там, где их не было в исходнике.\n\nВ конце прочитайте текст вслух: одинаковый ритм и слишком ровные формулировки заметнее всего именно на слух.",
      placement: "workspace.home.articles",
      active: true,
    },
    {
      key: "business.hero",
      locale: "ru",
      title: "Business кабинет nomduchat",
      body: "AI-агент, CRM, роли сотрудников, аналитика обращений и база знаний компании в одном контуре.",
      placement: "business",
      active: true,
    },
    {
      key: "agents.intro",
      locale: "ru",
      title: "Агенты nomduchat",
      body: "Выбирайте режим под задачу: текст, код, учеба, бизнес и ежедневные сценарии.",
      placement: "agents",
      active: true,
    },
  ];
}

function mapFeatureFlagRow(row: FeatureFlagRow): AdminFeatureFlagRecord {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    enabled: row.enabled,
    audience: row.audience,
    rolloutPercent: Number(row.rollout_percent),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAiProviderSettingRow(
  row: AiProviderSettingRow,
  configured?: ReturnType<typeof getConfiguredProviders>[number]
): AdminAiProviderSettingRecord {
  const metadata = toObject(row.metadata);
  const trafficMode =
    row.traffic_mode === "primary" || row.traffic_mode === "reserve" || row.traffic_mode === "paused"
      ? row.traffic_mode
      : "paused";
  return {
    code: row.provider_code,
    name: row.name,
    enabled: row.enabled,
    backendConfigured: Boolean(configured?.enabled ?? metadata.backendConfigured),
    model: row.model,
    trafficMode,
    modalities: Array.isArray(row.modalities) ? row.modalities.map(String) : configured?.modalities ?? [],
    reason: typeof metadata.reason === "string" ? metadata.reason : configured?.reason ?? "Настройка хранится в админ-панели.",
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAdminAgentRecord(agent: AgentRecord): AdminAgentRecord {
  return {
    id: agent.id,
    name: agent.name,
    category: agent.category,
    description: agent.description,
    enabled: agent.enabled,
    inputTypes: agent.inputTypes,
    outputTypes: agent.outputTypes,
    defaultModel: agent.defaultModel,
    fallbackModels: agent.fallbackModels,
    priceMultiplier: agent.priceMultiplier,
  };
}

function mapPromotionRow(row: PromotionRow): AdminPromotionRecord {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    placement: row.placement,
    audience: row.audience,
    active: row.active,
    startsAt: row.starts_at ? toIsoString(row.starts_at) : null,
    endsAt: row.ends_at ? toIsoString(row.ends_at) : null,
    priority: Number(row.priority),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapContentBlockRow(row: ContentBlockRow): AdminContentBlockRecord {
  return {
    key: row.key,
    locale: row.locale,
    title: row.title,
    body: row.body,
    placement: row.placement,
    active: row.active,
    updatedAt: toIsoString(row.updated_at),
  };
}

function toPublicContentBlock(block: AdminContentBlockRecord): PublicContentBlockRecord {
  return {
    key: block.key,
    locale: block.locale,
    title: block.title,
    body: block.body,
    placement: block.placement,
    updatedAt: block.updatedAt,
  };
}

function mapAuditLogRow(row: AuditLogRow): AdminAuditRecord {
  return {
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: toIsoString(row.created_at),
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function defaultPaymentProviders(): AdminPaymentProviderReport[] {
  return [
    {
      provider: "kaspi",
      label: "Kaspi",
      currency: "KZT",
      total: emptyPaymentStat(),
      paid: emptyPaymentStat(),
      pending: emptyPaymentStat(),
      cancelled: emptyPaymentStat(),
      failed: emptyPaymentStat(),
      creditsGrantedCount: 0,
    },
    {
      provider: "yookassa",
      label: "YooKassa",
      currency: "RUB",
      total: emptyPaymentStat(),
      paid: emptyPaymentStat(),
      pending: emptyPaymentStat(),
      cancelled: emptyPaymentStat(),
      failed: emptyPaymentStat(),
      creditsGrantedCount: 0,
    },
  ];
}

function emptyPaymentStat(): AdminPaymentStat {
  return {
    count: 0,
    amountMinor: 0,
  };
}

function fallbackPaymentReport(): AdminPaymentReport {
  return {
    providers: defaultPaymentProviders(),
    note: "Отчет по оплатам не удалось загрузить из базы. Значения не подменяются демо-данными.",
  };
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "nomduchat exchange-rate updater",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Exchange rate source failed with ${response.status}.`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseCbrCurrencyRate(xml: string, code: string) {
  const valutes = xml.match(/<Valute\b[\s\S]*?<\/Valute>/g) ?? [];
  const block = valutes.find((item) => tagValue(item, "CharCode") === code);
  if (!block) return null;

  const vunitRate = parseLocalizedNumber(tagValue(block, "VunitRate"));
  if (vunitRate !== null) return vunitRate;

  const value = parseLocalizedNumber(tagValue(block, "Value"));
  const nominal = parseLocalizedNumber(tagValue(block, "Nominal")) ?? 1;
  return value !== null ? value / nominal : null;
}

function parseNbkCurrencyRate(xml: string, code: string) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/g) ?? [];
  const block = items.find((item) => stripXmlValue(tagValue(item, "title")) === code);
  if (!block) return null;

  const value = parseLocalizedNumber(tagValue(block, "description"));
  const quant = parseLocalizedNumber(tagValue(block, "quant")) ?? 1;
  return value !== null ? value / quant : null;
}

function parseCbrDate(xml: string) {
  const rawDate = xml.match(/<ValCurs\b[^>]*Date="([^"]+)"/)?.[1];
  return normalizeDate(rawDate ?? null);
}

function parseNbkDate(xml: string) {
  const pubDate = tagValue(xml, "pubDate");
  return normalizeDate(pubDate);
}

function tagValue(xml: string, tag: string) {
  return stripXmlValue(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? null);
}

function stripXmlValue(value: string | null) {
  if (!value) return null;
  return value
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

function parseLocalizedNumber(value: string | null) {
  if (!value) return null;
  const number = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function normalizeDate(value: string | null) {
  if (!value) return null;

  const cbrDate = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (cbrDate) {
    return `${cbrDate[3]}-${cbrDate[2]}-${cbrDate[1]}`;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value;
}

function mapAdminUserRow(row: AdminUserSearchRow): AdminUserRecord {
  const payments = parseArray<AdminUserPaymentRecord>(row.payments).map((payment) => ({
    id: String(payment.id),
    planId: String(payment.planId),
    status: String(payment.status),
    provider: String(payment.provider),
    currency: String(payment.currency),
    amountMinor: Number(payment.amountMinor),
    createdAt: toIsoString(payment.createdAt),
  }));

  const projects = parseArray<AdminUserProjectRecord>(row.projects).map((project) => ({
    id: String(project.id),
    name: String(project.name),
    type: String(project.type),
    status: String(project.status),
    assetsCount: Number(project.assetsCount),
    updatedAt: toIsoString(project.updatedAt),
  }));

  return {
    id: toPublicUserId(row.id),
    name: row.display_name ?? row.email ?? "nomduchat User",
    email: row.email,
    phone: row.phone,
    country: row.country_code,
    language: row.language,
    systemRole: row.system_role ?? "user",
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    activePlanId: row.active_plan_id,
    subscriptionStatus: row.subscription_status,
    wallet: {
      availableCredits: Number(row.available_credits ?? 0),
      reservedCredits: Number(row.reserved_credits ?? 0),
    },
    activity: {
      chatsCount: Number(row.chats_count ?? 0),
      messagesCount: Number(row.messages_count ?? 0),
      totalCreditsSpent: Number(row.total_credits_spent ?? 0),
      freeCreditsSpent: Number(row.free_credits_spent ?? 0),
      filesCount: Number(row.files_count ?? 0),
      projectsCount: Number(row.projects_count ?? 0),
      mediaAssetsCount: Number(row.media_assets_count ?? 0),
      lastActivityAt: row.last_activity_at ? toIsoString(row.last_activity_at) : null,
    },
    payments,
    projects,
  };
}

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function isPlanId(value: string): value is PlanId {
  return value === "base" || value === "ultra" || value === "pro" || value === "business";
}

function isCountry(value: string): value is SubscriptionCountry {
  return value === "KZ" || value === "RU";
}

function currencyForCountry(country: SubscriptionCountry) {
  return country === "KZ" ? "KZT" : "RUB";
}

function sortOrder(planId: PlanId) {
  return planId === "base" ? 10 : planId === "ultra" ? 20 : planId === "pro" ? 30 : 40;
}

function defaultProviderModel(code: string) {
  if (code === "openai") return "gpt-4o-mini";
  if (code === "anthropic") return "anthropic-text-configured";
  if (code === "gemini") return "gemini-text-configured";
  return "mock-text";
}
