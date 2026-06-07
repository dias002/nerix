import { ok } from "../../domain/result.js";
import type { DatabaseClient } from "../../database/index.js";
import type { PlanId, SubscriptionCountry } from "../subscriptions/subscription.types.js";
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
    }>;
  }>;
};

const exchangeRateTtlMs = 24 * 60 * 60 * 1000;
const cbrDailyUrl = "https://www.cbr.ru/scripts/XML_daily.asp";
const nbkDailyUrl = "https://nationalbank.kz/rss/rates_all.xml";

export class AdminService {
  private exchangeRateCache: { expiresAt: number; rates: AdminPricingState["exchangeRates"] } | null = null;

  constructor(private readonly database: DatabaseClient) {}

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
      await this.database.query(
        `
          update plan_prices pp
          set amount_minor = $3,
              price_source = 'admin_fixed_rate',
              updated_at = now()
          from plans p
          where pp.plan_id = p.id
            and p.slug = $1
            and pp.country_code = $2
        `,
        [input.planId, input.country, input.amountMinor]
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
          left join wallets w on w.user_id = u.id and w.currency = 'NERIX'
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
            pp.amount_minor
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
        "User-Agent": "Nerix exchange-rate updater",
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
    name: row.display_name ?? row.email ?? "Nerix User",
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
