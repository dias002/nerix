import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  Bot,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  DollarSign,
  FilePenLine,
  FileText,
  FolderKanban,
  Lock,
  Megaphone,
  MessageSquare,
  Plug,
  Power,
  Radio,
  RefreshCw,
  Search,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  getAdminAiBudget,
  getAdminControlState,
  getAdminUsers,
  getAdminOverview,
  toPublicApiError,
  updateAdminAgent,
  updateAdminAiProvider,
  updateAdminContentBlock,
  updateAdminFeatureFlag,
  updateAdminPlanPrice,
  updateAdminPromotion,
  type AdminAgentApiRecord,
  type AdminAiBudgetApiResponse,
  type AdminAiProviderSettingApiRecord,
  type AdminContentBlockApiRecord,
  type AdminControlStateApiResponse,
  type AdminFeatureFlagApiRecord,
  type AdminOverviewApiResponse,
  type AdminPricingApiRecord,
  type AdminPromotionApiRecord,
  type AdminUsersApiResponse,
  type PlanId,
} from "../api";
import { useAuth } from "../auth";
import { useLocation, useSearchParams } from "react-router";
import { AiBudgetProviderCard, PaymentStat, UserStat } from "./admin/components";
import {
  contentBlockDraftFromRecord,
  contentBlockDraftsFromControl,
  contentBlockKey,
  featureFlagDraftFromRecord,
  featureFlagDraftsFromControl,
  priceDrafts,
  priceKey,
  promotionDraftFromRecord,
  promotionDraftsFromControl,
  providerModelDraftsFromControl,
} from "./admin/drafts";
import {
  createEmptyAdminAiBudget,
  createEmptyAdminControlState,
  createEmptyAdminOverview,
  createEmptyAdminUsers,
} from "./admin/emptyStates";
import {
  agentCategoryLabel,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatRate,
  modalityLabel,
  trafficModeLabel,
} from "./admin/formatters";
import { adminHeader, readAdminPathTab, readAdminTab } from "./admin/navigation";
import { statusClass } from "./admin/styles";
import type { AdminTab, ContentBlockDraft, FeatureFlagDraft, PromotionDraft } from "./admin/types";

export default function Admin() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tabFromUrl = readAdminPathTab(location.pathname) ?? readAdminTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<AdminTab>(tabFromUrl);
  const [overview, setOverview] = useState<AdminOverviewApiResponse | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUsersApiResponse | null>(null);
  const [controlState, setControlState] = useState<AdminControlStateApiResponse | null>(null);
  const [aiBudget, setAiBudget] = useState<AdminAiBudgetApiResponse | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [providerModelDrafts, setProviderModelDrafts] = useState<Record<string, string>>({});
  const [featureFlagDrafts, setFeatureFlagDrafts] = useState<Record<string, FeatureFlagDraft>>({});
  const [promotionDrafts, setPromotionDrafts] = useState<Record<string, PromotionDraft>>({});
  const [contentBlockDrafts, setContentBlockDrafts] = useState<Record<string, ContentBlockDraft>>({});
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);
  const [aiBudgetLoading, setAiBudgetLoading] = useState(false);
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [controlBusyKey, setControlBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const emptyOverview = useMemo(createEmptyAdminOverview, []);
  const emptyUsers = useMemo(() => createEmptyAdminUsers(userSearch), [userSearch]);
  const emptyControlState = useMemo(createEmptyAdminControlState, []);
  const emptyAiBudget = useMemo(createEmptyAdminAiBudget, []);
  const effectiveOverview = overview ?? emptyOverview;
  const effectiveUsers = adminUsers ?? emptyUsers;
  const effectiveControl = controlState ?? emptyControlState;
  const effectiveAiBudget = aiBudget ?? emptyAiBudget;

  const pricing = effectiveOverview.pricing;
  const memory = effectiveOverview.memory;
  const direction = effectiveOverview.businessDirection;
  const paymentReport = effectiveOverview.paymentReport;
  const header = adminHeader(activeTab);
  const controlCounts = useMemo(
    () => [
      {
        label: "Агенты",
        value: formatNumber(effectiveControl.agents.filter((agent) => agent.enabled).length),
        detail: `${formatNumber(effectiveControl.agents.length)} в агрегаторе`,
        icon: Sparkles,
      },
      {
        label: "AI/API",
        value: formatNumber(effectiveControl.aiProviders.filter((provider) => provider.enabled).length),
        detail: `${formatNumber(effectiveControl.aiProviders.length)} провайдеров`,
        icon: Bot,
      },
      {
        label: "Акции",
        value: formatNumber(effectiveControl.promotions.filter((promotion) => promotion.active).length),
        detail: `${formatNumber(effectiveControl.promotions.length)} промо-блоков`,
        icon: Megaphone,
      },
      {
        label: "Функции",
        value: formatNumber(effectiveControl.featureFlags.filter((flag) => flag.enabled).length),
        detail: `${formatNumber(effectiveControl.featureFlags.length)} флагов`,
        icon: SlidersHorizontal,
      },
      {
        label: "Контент",
        value: formatNumber(effectiveControl.contentBlocks.filter((block) => block.active).length),
        detail: `${formatNumber(effectiveControl.contentBlocks.length)} блоков`,
        icon: FilePenLine,
      },
    ],
    [effectiveControl]
  );
  const aiBudgetStats = useMemo(
    () => [
      {
        label: "Остаток",
        value: formatUsdNullable(effectiveAiBudget.totals.balanceUsd),
        detail: `бюджет ${formatUsdNullable(effectiveAiBudget.totals.budgetUsd)}`,
        icon: Wallet,
      },
      {
        label: "Кредиты",
        value: formatCompactCredits(effectiveAiBudget.totals.estimatedCreditsRemaining),
        detail: `${formatNumber(effectiveAiBudget.creditsPerUsd)} кредитов за $1`,
        icon: Sparkles,
      },
      {
        label: "Расход за 30 дней",
        value: formatUsdNullable(effectiveAiBudget.totals.spentUsd30d),
        detail: `${formatCompactCredits(effectiveAiBudget.totals.spentCredits30d)} списано`,
        icon: Activity,
      },
      {
        label: "Прогноз",
        value: formatDaysRemaining(effectiveAiBudget.totals.daysRemaining),
        detail: `${formatUsdNullable(effectiveAiBudget.totals.avgUsdPerDay30d)} в день`,
        icon: TrendingUp,
      },
    ],
    [effectiveAiBudget]
  );

  const memoryStats = useMemo(
    () => [
      { label: "Чатов в базе", value: formatNumber(memory.totalChats), detail: "Содержимое не раскрывается", icon: Database },
      { label: "Сообщений", value: formatNumber(memory.totalMessages), detail: "Только количество", icon: Activity },
      { label: "Сжатых summary", value: formatNumber(memory.summarizedChats), detail: "Подготовлено для памяти", icon: Brain },
      { label: "Элементов памяти", value: formatNumber(memory.memoryItems), detail: "Факты и контекст", icon: Lock },
    ],
    [memory]
  );

  useEffect(() => {
    void loadOverview();
  }, [user?.permissions.adminPanel]);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (activeTab === "users") {
      void loadUsers(userSearch);
    }
  }, [activeTab, user?.permissions.adminPanel]);

  useEffect(() => {
    if (activeTab === "control") {
      void loadControl();
    }
  }, [activeTab, user?.permissions.adminPanel]);

  useEffect(() => {
    if (activeTab === "ai-budget") {
      void loadAiBudget();
    }
  }, [activeTab, user?.permissions.adminPanel]);

  useEffect(() => {
    setDraftPrices(priceDrafts(pricing));
  }, [pricing]);

  useEffect(() => {
    setProviderModelDrafts(providerModelDraftsFromControl(effectiveControl.aiProviders));
    setFeatureFlagDrafts(featureFlagDraftsFromControl(effectiveControl.featureFlags));
    setPromotionDrafts(promotionDraftsFromControl(effectiveControl.promotions));
    setContentBlockDrafts(contentBlockDraftsFromControl(effectiveControl.contentBlocks));
  }, [effectiveControl]);

  const loadOverview = async () => {
    if (!user?.permissions.adminPanel) {
      setOverview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setOverview(await getAdminOverview());
    } catch {
      setOverview(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (query = userSearch) => {
    if (!user?.permissions.adminPanel) {
      setAdminUsers(null);
      setUsersLoading(false);
      return;
    }

    setUsersLoading(true);
    setUsersError(null);
    try {
      setAdminUsers(await getAdminUsers(query));
    } catch {
      setAdminUsers(null);
      setUsersError(null);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadControl = async () => {
    if (!user?.permissions.adminPanel) {
      setControlState(null);
      setControlLoading(false);
      return;
    }

    setControlLoading(true);
    try {
      setControlState(await getAdminControlState());
    } catch {
      setControlState(null);
    } finally {
      setControlLoading(false);
    }
  };

  const loadAiBudget = async () => {
    if (!user?.permissions.adminPanel) {
      setAiBudget(null);
      setAiBudgetLoading(false);
      return;
    }

    setAiBudgetLoading(true);
    try {
      setAiBudget(await getAdminAiBudget());
    } catch {
      setAiBudget(null);
    } finally {
      setAiBudgetLoading(false);
    }
  };

  const submitUserSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadUsers(userSearch);
  };

  const savePrice = async (planId: PlanId, country: "KZ" | "RU") => {
    const key = priceKey(planId, country);
    const amount = Number(draftPrices[key]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Цена должна быть положительным числом.");
      return;
    }

    setSavingPrice(key);
    setError(null);
    setNotice(null);

    try {
      const amountMinor = Math.round(amount * 100);
      const response = await updateAdminPlanPrice({ planId, country, amountMinor });
      setOverview((current) => ({ ...(current ?? emptyOverview), pricing: response.pricing }));
      setNotice("Прайс обновлен. Эта цена теперь используется в тарифах для пользователей.");
    } catch (saveError) {
      setError(toPublicApiError(saveError, "Не удалось сохранить цену."));
    } finally {
      setSavingPrice(null);
    }
  };

  const runControlAction = async (busyKey: string, callback: () => Promise<AdminControlStateApiResponse>, message: string) => {
    setControlBusyKey(busyKey);
    setError(null);
    setNotice(null);

    try {
      setControlState(await callback());
      setNotice(message);
    } catch (controlError) {
      setError(toPublicApiError(controlError, "Не удалось сохранить настройку."));
    } finally {
      setControlBusyKey(null);
    }
  };

  const saveProviderModel = async (provider: AdminAiProviderSettingApiRecord) => {
    const model = providerModelDrafts[provider.code]?.trim() || provider.model;
    await runControlAction(
      `provider-model:${provider.code}`,
      () => updateAdminAiProvider(provider.code, { model }),
      "Модель провайдера обновлена."
    );
  };

  const toggleProvider = async (provider: AdminAiProviderSettingApiRecord) => {
    await runControlAction(
      `provider-toggle:${provider.code}`,
      () =>
        updateAdminAiProvider(provider.code, {
          enabled: !provider.enabled,
          trafficMode: provider.enabled ? "paused" : provider.trafficMode === "paused" ? "primary" : provider.trafficMode,
        }),
      provider.enabled ? "Провайдер поставлен на паузу." : "Провайдер запущен."
    );
  };

  const toggleAgent = async (agent: AdminAgentApiRecord) => {
    await runControlAction(
      `agent-toggle:${agent.id}`,
      () => updateAdminAgent(agent.id, { enabled: !agent.enabled }),
      agent.enabled ? "Агент выключен в агрегаторе." : "Агент включен в агрегаторе."
    );
  };

  const changeProviderTraffic = async (
    provider: AdminAiProviderSettingApiRecord,
    trafficMode: AdminAiProviderSettingApiRecord["trafficMode"]
  ) => {
    await runControlAction(
      `provider-traffic:${provider.code}`,
      () => updateAdminAiProvider(provider.code, { trafficMode, enabled: trafficMode !== "paused" }),
      "Режим трафика провайдера обновлен."
    );
  };

  const saveFeatureFlag = async (flag: AdminFeatureFlagApiRecord) => {
    const draft = featureFlagDrafts[flag.key] ?? featureFlagDraftFromRecord(flag);
    const rolloutPercent = Number(draft.rolloutPercent);
    if (!Number.isInteger(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100) {
      setError("Процент раскатки должен быть целым числом от 0 до 100.");
      return;
    }

    await runControlAction(
      `feature-save:${flag.key}`,
      () =>
        updateAdminFeatureFlag(flag.key, {
          label: draft.label,
          description: draft.description,
          audience: draft.audience,
          rolloutPercent,
        }),
      "Флаг функции обновлен."
    );
  };

  const toggleFeatureFlag = async (flag: AdminFeatureFlagApiRecord) => {
    await runControlAction(
      `feature-toggle:${flag.key}`,
      () => updateAdminFeatureFlag(flag.key, { enabled: !flag.enabled }),
      flag.enabled ? "Функция выключена." : "Функция включена."
    );
  };

  const savePromotion = async (promotion: AdminPromotionApiRecord) => {
    const draft = promotionDrafts[promotion.slug] ?? promotionDraftFromRecord(promotion);
    const priority = Number(draft.priority);
    if (!Number.isInteger(priority) || priority < 0) {
      setError("Приоритет акции должен быть целым числом от 0 и выше.");
      return;
    }

    await runControlAction(
      `promotion-save:${promotion.slug}`,
      () =>
        updateAdminPromotion(promotion.slug, {
          title: draft.title,
          body: draft.body,
          placement: draft.placement,
          audience: draft.audience,
          priority,
        }),
      "Акция обновлена."
    );
  };

  const togglePromotion = async (promotion: AdminPromotionApiRecord) => {
    await runControlAction(
      `promotion-toggle:${promotion.slug}`,
      () => updateAdminPromotion(promotion.slug, { active: !promotion.active }),
      promotion.active ? "Акция остановлена." : "Акция запущена."
    );
  };

  const saveContentBlock = async (block: AdminContentBlockApiRecord) => {
    const draftKey = contentBlockKey(block);
    const draft = contentBlockDrafts[draftKey] ?? contentBlockDraftFromRecord(block);
    await runControlAction(
      `content-save:${draftKey}`,
      () =>
        updateAdminContentBlock(block.key, {
          locale: block.locale,
          title: draft.title,
          body: draft.body,
          placement: draft.placement,
        }),
      "Контентный блок обновлен."
    );
  };

  const toggleContentBlock = async (block: AdminContentBlockApiRecord) => {
    const draftKey = contentBlockKey(block);
    await runControlAction(
      `content-toggle:${draftKey}`,
      () => updateAdminContentBlock(block.key, { locale: block.locale, active: !block.active }),
      block.active ? "Контентный блок скрыт." : "Контентный блок опубликован."
    );
  };

  if (!user?.permissions.adminPanel) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#050505] p-6 text-white md:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <ShieldCheck className="h-9 w-9 text-gray-500" strokeWidth={1.5} />
          <h1 className="mt-5 text-3xl font-medium">Админ-панель закрыта</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Управление направлением проекта, памятью и прайсом доступно только роли администратора.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-gray-600">Администрирование</p>
            <h1 className="mt-2 text-4xl font-medium">{header.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
              {header.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeTab === "users") {
                void loadUsers(userSearch);
              } else if (activeTab === "control") {
                void loadControl();
              } else if (activeTab === "ai-budget") {
                void loadAiBudget();
              } else {
                void loadOverview();
              }
            }}
            disabled={loading || usersLoading || controlLoading || aiBudgetLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading || usersLoading || controlLoading || aiBudgetLoading ? "animate-spin" : ""}`}
              strokeWidth={1.7}
            />
            Обновить
          </button>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        {activeTab === "direction" ? (
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {direction.metrics.map((metric) => (
                <article key={metric.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <TrendingUp className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <p className="mt-6 text-3xl font-medium">{loading ? "..." : metric.value}</p>
                  <h2 className="mt-2 text-sm font-medium text-gray-200">{metric.label}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{metric.detail}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <h2 className="text-xl font-medium">Что происходит с направлением</h2>
                </div>
                <div className="mt-5 space-y-3">
                  {direction.signals.map((signal) => (
                    <div key={signal.title} className={`rounded-2xl border p-4 ${statusClass[signal.status]}`}>
                      <h3 className="text-sm font-medium">{signal.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed opacity-80">{signal.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <div>
                    <h2 className="text-xl font-medium">Приоритеты админа</h2>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      Это не кнопки и не пользовательские функции, а список решений, которые сейчас стоит держать в фокусе по продукту.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {direction.nextSteps.map((step) => (
                    <div key={step} className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-black p-4 text-sm text-gray-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.7} />
                      <span className="min-w-0 break-words">{step}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <h2 className="text-xl font-medium">Отчет по оплатам</h2>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                    Kaspi и YooKassa считаются отдельно. В оплаченные попадают только платежи со статусом completed.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {paymentReport.providers.map((provider) => (
                  <div key={provider.provider} className="rounded-2xl border border-white/10 bg-black p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-medium text-white">{provider.label}</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-700">{provider.provider}</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-gray-400">
                        {provider.currency}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <PaymentStat label="Оплачено" stat={provider.paid} currency={provider.currency} tone="good" />
                      <PaymentStat label="Ожидает" stat={provider.pending} currency={provider.currency} />
                      <PaymentStat label="Отменено" stat={provider.cancelled} currency={provider.currency} />
                      <PaymentStat label="Ошибка" stat={provider.failed} currency={provider.currency} tone="risk" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Всего платежей: {formatNumber(provider.total.count)}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Кредиты выданы: {formatNumber(provider.creditsGrantedCount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs leading-relaxed text-gray-600">{paymentReport.note}</p>
            </article>
          </section>
        ) : null}

        {activeTab === "users" ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <UserRound className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <h2 className="text-xl font-medium">Поиск пользователей</h2>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                    Поиск идет по имени, email, телефону или id. В карточке видны платежи, активность, расход кредитов и папки проектов без доступа к содержимому.
                  </p>
                </div>
                <form onSubmit={submitUserSearch} className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-xl">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" strokeWidth={1.7} />
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Имя, email, телефон или id"
                      className="h-11 w-full rounded-xl border border-white/10 bg-black pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-700 focus:border-white/25"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={usersLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" strokeWidth={1.8} />
                    Найти
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" strokeWidth={1.5} />
                <p className="text-sm leading-relaxed text-gray-400">{effectiveUsers.privacyNote}</p>
              </div>
            </div>

            {usersError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {usersError}
              </div>
            ) : null}

            {usersLoading ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-gray-500">
                Загружаю пользователей...
              </div>
            ) : effectiveUsers.users.length > 0 ? (
              <div className="space-y-4">
                {effectiveUsers.users.map((adminUser) => (
                  <article key={adminUser.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black">
                            <UserRound className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-medium text-white">{adminUser.name}</h3>
                            <p className="truncate text-sm text-gray-500">{adminUser.email ?? adminUser.phone ?? adminUser.id}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">id: {adminUser.id}</span>
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">{adminUser.country}</span>
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">{adminUser.systemRole}</span>
                          <span className="rounded-full border border-white/10 bg-black px-3 py-1">
                            {adminUser.activePlanId ?? "без подписки"}
                            {adminUser.subscriptionStatus ? ` · ${adminUser.subscriptionStatus}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <CalendarDays className="h-4 w-4" strokeWidth={1.6} />
                          С нами
                        </div>
                        <div className="mt-1 text-sm text-white">{formatDate(adminUser.createdAt)}</div>
                        <div className="mt-1 text-xs text-gray-600">
                          Последняя активность: {adminUser.activity.lastActivityAt ? formatDate(adminUser.activity.lastActivityAt) : "нет данных"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <UserStat icon={MessageSquare} label="Чаты / сообщения" value={`${formatNumber(adminUser.activity.chatsCount)} / ${formatNumber(adminUser.activity.messagesCount)}`} />
                      <UserStat icon={Wallet} label="Кредиты в кошельке" value={formatNumber(adminUser.wallet.availableCredits)} detail={`${formatNumber(adminUser.wallet.reservedCredits)} зарезервировано`} />
                      <UserStat icon={Activity} label="Потрачено кредитов" value={formatNumber(adminUser.activity.totalCreditsSpent)} detail={`${formatNumber(adminUser.activity.freeCreditsSpent)} бесплатных`} />
                      <UserStat icon={FolderKanban} label="Проекты / файлы" value={`${formatNumber(adminUser.activity.projectsCount)} / ${formatNumber(adminUser.activity.filesCount)}`} detail={`${formatNumber(adminUser.activity.mediaAssetsCount)} медиа`} />
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black p-4">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-gray-500" strokeWidth={1.6} />
                          <h4 className="text-sm font-medium text-gray-200">История платежей</h4>
                        </div>
                        <div className="mt-4 space-y-2">
                          {adminUser.payments.length > 0 ? (
                            adminUser.payments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <div className="truncate text-gray-200">{payment.planId} · {payment.provider}</div>
                                  <div className="text-xs text-gray-600">{formatDate(payment.createdAt)} · {payment.status}</div>
                                </div>
                                <div className="shrink-0 text-gray-400">{formatMoney(payment.amountMinor, payment.currency)}</div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">Платежей пока нет.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black p-4">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-gray-500" strokeWidth={1.6} />
                          <h4 className="text-sm font-medium text-gray-200">Папки проектов</h4>
                        </div>
                        <div className="mt-4 space-y-2">
                          {adminUser.projects.length > 0 ? (
                            adminUser.projects.map((project) => (
                              <div key={project.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <div className="truncate text-gray-200">{project.name}</div>
                                  <div className="text-xs text-gray-600">
                                    {project.type} · {project.status} · обновлено {formatDate(project.updatedAt)}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                                  <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
                                  {project.assetsCount}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">Проектов пока нет.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-gray-500">
                Пользователи не найдены.
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "memory" ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Brain className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <h2 className="text-xl font-medium">Память и чаты в базе</h2>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                    Все чаты архитектурно хранятся в базе и участвуют в памяти через summary, но админ видит только счетчики, заполнение и техническое состояние.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black px-5 py-4">
                  <div className="text-sm text-gray-500">Заполнение памяти</div>
                  <div className="mt-2 text-3xl font-medium">{memory.fillPercent}%</div>
                </div>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white" style={{ width: `${memory.fillPercent}%` }} />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                {formatNumber(memory.memoryTokens)} из {formatNumber(memory.memoryLimitTokens)} токенов памяти.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {memoryStats.map((stat) => (
                <article key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <stat.icon className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <p className="mt-6 text-3xl font-medium">{stat.value}</p>
                  <h3 className="mt-2 text-sm font-medium text-gray-200">{stat.label}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{stat.detail}</p>
                </article>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" strokeWidth={1.5} />
                <p className="text-sm leading-relaxed text-gray-400">{memory.privateNote}</p>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "control" ? (
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {controlCounts.map((stat) => (
                <article key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <stat.icon className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <p className="mt-6 text-3xl font-medium">{controlLoading ? "..." : stat.value}</p>
                  <h2 className="mt-2 text-sm font-medium text-gray-200">{stat.label}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{stat.detail}</p>
                </article>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" strokeWidth={1.5} />
                <p className="text-sm leading-relaxed text-gray-400">
                  {effectiveControl.note || "Настройки запуска хранятся в базе и применяются без правки кода."}
                </p>
              </div>
            </div>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <h2 className="text-xl font-medium">Агенты агрегатора</h2>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    Включенные агенты доступны пользователям и участвуют в AI Gateway. Выключенный агент скрывается из списка и не принимает прямые запросы.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-400">
                  <Bot className="h-3.5 w-3.5" strokeWidth={1.7} />
                  {formatNumber(effectiveControl.agents.filter((agent) => agent.enabled).length)} активно
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {effectiveControl.agents.length > 0 ? (
                  effectiveControl.agents.map((agent) => (
                    <div key={agent.id} className="rounded-2xl border border-white/10 bg-black p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium text-white">{agent.name}</h3>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-500">
                              {agent.id}
                            </span>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-500">
                              {agentCategoryLabel(agent.category)}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs ${
                                agent.enabled
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                  : "border-white/10 text-gray-500"
                              }`}
                            >
                              {agent.enabled ? "активен" : "выключен"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-gray-600">{agent.description}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            вход: {agent.inputTypes.map(modalityLabel).join(" · ")} / выход:{" "}
                            {agent.outputTypes.map(modalityLabel).join(" · ")}
                          </p>
                          <p className="mt-2 text-xs text-gray-600">
                            модель {agent.defaultModel} · x{agent.priceMultiplier}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleAgent(agent)}
                          disabled={Boolean(controlBusyKey)}
                          className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm transition-colors disabled:opacity-60 ${
                            agent.enabled
                              ? "border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                              : "bg-white text-black hover:bg-gray-200"
                          }`}
                        >
                          <Power className="h-4 w-4" strokeWidth={1.8} />
                          {controlBusyKey === `agent-toggle:${agent.id}`
                            ? "Сохраняю"
                            : agent.enabled
                              ? "Остановить"
                              : "Запустить"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500 lg:col-span-2">
                    Агенты не загрузились из API. После запуска backend здесь появится реальный registry агрегатора.
                  </div>
                )}
              </div>
            </article>

            <div className="grid gap-5 xl:[grid-template-columns:minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <article className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                      <h2 className="text-xl font-medium">AI/API провайдеры</h2>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      Управление запуском, резервом и моделью. Ключи API остаются на backend, здесь видно только готовность подключения.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-400">
                    <Plug className="h-3.5 w-3.5" strokeWidth={1.7} />
                    политика {effectiveControl.policyMode || "local"}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {effectiveControl.aiProviders.length > 0 ? (
                    effectiveControl.aiProviders.map((provider) => (
                      <div key={provider.code} className="rounded-2xl border border-white/10 bg-black p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-medium text-white">{provider.name}</h3>
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-500">
                                {provider.code}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-xs ${
                                  provider.enabled
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                    : "border-white/10 text-gray-500"
                                }`}
                              >
                                {provider.enabled ? "запущен" : "пауза"}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-xs ${
                                  provider.backendConfigured
                                    ? "border-white/10 text-gray-400"
                                    : "border-amber-400/20 bg-amber-400/10 text-amber-100"
                                }`}
                              >
                                {provider.backendConfigured ? "ключ есть" : "ключ не задан"}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-gray-600">{provider.reason}</p>
                            <p className="mt-2 text-xs text-gray-500">
                              {provider.modalities.map(modalityLabel).join(" · ")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void toggleProvider(provider)}
                            disabled={Boolean(controlBusyKey)}
                            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm transition-colors disabled:opacity-60 ${
                              provider.enabled
                                ? "border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                                : "bg-white text-black hover:bg-gray-200"
                            }`}
                          >
                            <Power className="h-4 w-4" strokeWidth={1.8} />
                            {controlBusyKey === `provider-toggle:${provider.code}`
                              ? "Сохраняю"
                              : provider.enabled
                                ? "Остановить"
                                : "Запустить"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 md:[grid-template-columns:minmax(0,1fr)_180px_44px]">
                          <label className="block min-w-0">
                            <span className="text-xs text-gray-600">Модель</span>
                            <input
                              value={providerModelDrafts[provider.code] ?? provider.model}
                              onChange={(event) =>
                                setProviderModelDrafts((current) => ({
                                  ...current,
                                  [provider.code]: event.target.value,
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className="text-xs text-gray-600">Трафик</span>
                            <select
                              value={provider.trafficMode}
                              onChange={(event) =>
                                void changeProviderTraffic(
                                  provider,
                                  event.target.value as AdminAiProviderSettingApiRecord["trafficMode"]
                                )
                              }
                              disabled={Boolean(controlBusyKey)}
                              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25 disabled:opacity-60"
                            >
                              <option value="primary">Основной</option>
                              <option value="reserve">Резерв</option>
                              <option value="paused">Не использовать</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => void saveProviderModel(provider)}
                            disabled={Boolean(controlBusyKey)}
                            className="mt-5 inline-flex h-10 w-11 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-60 md:mt-5"
                            aria-label="Сохранить модель провайдера"
                          >
                            <Save className="h-4 w-4" strokeWidth={1.8} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500">
                      Провайдеры не загрузились из API. После запуска сервера здесь появятся реальные подключения.
                    </div>
                  )}
                </div>
              </article>

              <article className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Megaphone className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                      <h2 className="text-xl font-medium">Акции и объявления</h2>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      Промо-сообщения для тарифов, Business и продуктовых акций. Их можно включать и менять без деплоя.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-400">
                    <Radio className="h-3.5 w-3.5" strokeWidth={1.7} />
                    промо-лента
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {effectiveControl.promotions.length > 0 ? (
                    effectiveControl.promotions.map((promotion) => {
                      const draft = promotionDrafts[promotion.slug] ?? promotionDraftFromRecord(promotion);
                      return (
                        <div key={promotion.slug} className="rounded-2xl border border-white/10 bg-black p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-gray-500" strokeWidth={1.7} />
                                <h3 className="truncate text-sm font-medium text-white">{promotion.title}</h3>
                              </div>
                              <p className="mt-2 text-xs text-gray-600">
                                {promotion.placement} · {promotion.audience}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void togglePromotion(promotion)}
                              disabled={Boolean(controlBusyKey)}
                              className={`inline-flex h-9 shrink-0 items-center justify-center rounded-xl px-3 text-xs transition-colors disabled:opacity-60 ${
                                promotion.active
                                  ? "border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                                  : "bg-white text-black hover:bg-gray-200"
                              }`}
                            >
                              {promotion.active ? "Пауза" : "Запустить"}
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            <input
                              value={draft.title}
                              onChange={(event) =>
                                setPromotionDrafts((current) => ({
                                  ...current,
                                  [promotion.slug]: { ...draft, title: event.target.value },
                                }))
                              }
                              className="h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                            />
                            <textarea
                              value={draft.body}
                              onChange={(event) =>
                                setPromotionDrafts((current) => ({
                                  ...current,
                                  [promotion.slug]: { ...draft, body: event.target.value },
                                }))
                              }
                              rows={3}
                              className="w-full resize-none rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm leading-relaxed text-white outline-none transition-colors focus:border-white/25"
                            />
                            <div className="grid gap-3 sm:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_96px_44px]">
                              <input
                                value={draft.placement}
                                onChange={(event) =>
                                  setPromotionDrafts((current) => ({
                                    ...current,
                                    [promotion.slug]: { ...draft, placement: event.target.value },
                                  }))
                                }
                                className="h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                              />
                              <input
                                value={draft.audience}
                                onChange={(event) =>
                                  setPromotionDrafts((current) => ({
                                    ...current,
                                    [promotion.slug]: { ...draft, audience: event.target.value },
                                  }))
                                }
                                className="h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                              />
                              <input
                                value={draft.priority}
                                onChange={(event) =>
                                  setPromotionDrafts((current) => ({
                                    ...current,
                                    [promotion.slug]: { ...draft, priority: event.target.value },
                                  }))
                                }
                                inputMode="numeric"
                                className="h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                              />
                              <button
                                type="button"
                                onClick={() => void savePromotion(promotion)}
                                disabled={Boolean(controlBusyKey)}
                                className="inline-flex h-10 w-11 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                                aria-label="Сохранить акцию"
                              >
                                <Save className="h-4 w-4" strokeWidth={1.8} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500">
                      Акции не загрузились из API. Новые промо-блоки появятся после инициализации базы.
                    </div>
                  )}
                </div>
              </article>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <article className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <h2 className="text-xl font-medium">Флаги функций</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Быстрое включение регистрации, OAuth, загрузки файлов, голосового ввода и бизнес-контура.
                </p>

                <div className="mt-5 space-y-3">
                  {effectiveControl.featureFlags.length > 0 ? (
                    effectiveControl.featureFlags.map((flag) => {
                      const draft = featureFlagDrafts[flag.key] ?? featureFlagDraftFromRecord(flag);
                      return (
                        <div key={flag.key} className="rounded-2xl border border-white/10 bg-black p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-medium text-white">{flag.label}</h3>
                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-500">
                                  {flag.key}
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-gray-600">{flag.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void toggleFeatureFlag(flag)}
                              disabled={Boolean(controlBusyKey)}
                              className={`inline-flex h-9 shrink-0 items-center justify-center rounded-xl px-3 text-xs transition-colors disabled:opacity-60 ${
                                flag.enabled
                                  ? "border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                                  : "bg-white text-black hover:bg-gray-200"
                              }`}
                            >
                              {flag.enabled ? "Включено" : "Выключено"}
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 md:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)_96px_44px]">
                            <input
                              value={draft.label}
                              onChange={(event) =>
                                setFeatureFlagDrafts((current) => ({
                                  ...current,
                                  [flag.key]: { ...draft, label: event.target.value },
                                }))
                              }
                              className="h-10 rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                            />
                            <input
                              value={draft.audience}
                              onChange={(event) =>
                                setFeatureFlagDrafts((current) => ({
                                  ...current,
                                  [flag.key]: { ...draft, audience: event.target.value },
                                }))
                              }
                              className="h-10 rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                            />
                            <input
                              value={draft.rolloutPercent}
                              onChange={(event) =>
                                setFeatureFlagDrafts((current) => ({
                                  ...current,
                                  [flag.key]: { ...draft, rolloutPercent: event.target.value },
                                }))
                              }
                              inputMode="numeric"
                              className="h-10 rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                            />
                            <button
                              type="button"
                              onClick={() => void saveFeatureFlag(flag)}
                              disabled={Boolean(controlBusyKey)}
                              className="inline-flex h-10 w-11 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                              aria-label="Сохранить флаг функции"
                            >
                              <Save className="h-4 w-4" strokeWidth={1.8} />
                            </button>
                          </div>
                          <textarea
                            value={draft.description}
                            onChange={(event) =>
                              setFeatureFlagDrafts((current) => ({
                                ...current,
                                [flag.key]: { ...draft, description: event.target.value },
                              }))
                            }
                            rows={2}
                            className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm leading-relaxed text-white outline-none transition-colors focus:border-white/25"
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500">
                      Флаги функций пока не загрузились из базы.
                    </div>
                  )}
                </div>
              </article>

              <article className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <FilePenLine className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <h2 className="text-xl font-medium">Текстовые блоки</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Заголовки и описания для ключевых страниц. Это заготовка CMS-слоя, который дальше можно подключать к лендингу и агентам.
                </p>

                <div className="mt-5 space-y-3">
                  {effectiveControl.contentBlocks.length > 0 ? (
                    effectiveControl.contentBlocks.map((block) => {
                      const draftKey = contentBlockKey(block);
                      const draft = contentBlockDrafts[draftKey] ?? contentBlockDraftFromRecord(block);
                      return (
                        <div key={draftKey} className="rounded-2xl border border-white/10 bg-black p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-medium text-white">{block.title || block.key}</h3>
                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-500">
                                  {block.key} · {block.locale}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-gray-600">{block.placement}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void toggleContentBlock(block)}
                              disabled={Boolean(controlBusyKey)}
                              className={`inline-flex h-9 shrink-0 items-center justify-center rounded-xl px-3 text-xs transition-colors disabled:opacity-60 ${
                                block.active
                                  ? "border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                                  : "bg-white text-black hover:bg-gray-200"
                              }`}
                            >
                              {block.active ? "Опубликован" : "Скрыт"}
                            </button>
                          </div>

                          <div className="mt-4 space-y-3">
                            <input
                              value={draft.title}
                              onChange={(event) =>
                                setContentBlockDrafts((current) => ({
                                  ...current,
                                  [draftKey]: { ...draft, title: event.target.value },
                                }))
                              }
                              className="h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                            />
                            <textarea
                              value={draft.body}
                              onChange={(event) =>
                                setContentBlockDrafts((current) => ({
                                  ...current,
                                  [draftKey]: { ...draft, body: event.target.value },
                                }))
                              }
                              rows={4}
                              className="w-full resize-none rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm leading-relaxed text-white outline-none transition-colors focus:border-white/25"
                            />
                            <div className="grid gap-3 sm:[grid-template-columns:minmax(0,1fr)_44px]">
                              <input
                                value={draft.placement}
                                onChange={(event) =>
                                  setContentBlockDrafts((current) => ({
                                    ...current,
                                    [draftKey]: { ...draft, placement: event.target.value },
                                  }))
                                }
                                className="h-10 w-full rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                              />
                              <button
                                type="button"
                                onClick={() => void saveContentBlock(block)}
                                disabled={Boolean(controlBusyKey)}
                                className="inline-flex h-10 w-11 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                                aria-label="Сохранить текстовый блок"
                              >
                                <Save className="h-4 w-4" strokeWidth={1.8} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500">
                      Контентные блоки пока не загрузились из базы.
                    </div>
                  )}
                </div>
              </article>
            </div>

            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                <h2 className="text-xl font-medium">Последние изменения</h2>
              </div>
              <div className="mt-5 space-y-2">
                {effectiveControl.auditLog.length > 0 ? (
                  effectiveControl.auditLog.map((item) => (
                    <div key={`${item.action}-${item.entityType}-${item.entityId}-${item.createdAt}`} className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-gray-300">
                        {item.action}
                        {item.entityId ? <span className="text-gray-600"> · {item.entityId}</span> : null}
                      </div>
                      <div className="shrink-0 text-xs text-gray-600">{formatDateTime(item.createdAt)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500">
                    Журнал изменений пока пуст. Первые записи появятся после сохранения настроек.
                  </div>
                )}
              </div>
            </article>
          </section>
        ) : null}

        {activeTab === "ai-budget" ? (
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {aiBudgetStats.map((stat) => (
                <article key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <stat.icon className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                  <p className="mt-6 text-3xl font-medium">{aiBudgetLoading ? "..." : stat.value}</p>
                  <h2 className="mt-2 text-sm font-medium text-gray-200">{stat.label}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{stat.detail}</p>
                </article>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black p-5">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" strokeWidth={1.5} />
                <div className="min-w-0 space-y-2">
                  <p className="text-sm leading-relaxed text-gray-400">
                    {effectiveAiBudget.note}
                  </p>
                  <p className="text-xs leading-relaxed text-gray-600">
                    Чтобы задать точный остаток, добавьте в Render Environment переменные OPENAI_BALANCE_USD,
                    ANTHROPIC_BALANCE_USD и GEMINI_BALANCE_USD. Если их нет, используется расчет от *_BUDGET_USD минус расход.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              {effectiveAiBudget.providers.length > 0 ? (
                effectiveAiBudget.providers.map((provider) => (
                  <AiBudgetProviderCard key={provider.code} provider={provider} />
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm leading-relaxed text-gray-500 xl:col-span-3">
                  Данные по AI бюджету пока не загрузились. Проверьте backend, ключи провайдеров и переменные бюджета в Render.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "pricing" ? (
          <section className="space-y-5">
            {pricing.exchangeRates.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {pricing.exchangeRates.map((rate) => (
                  <article key={rate.pair} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <DollarSign className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                    <div className="mt-5 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-500">{rate.pair}</p>
                        <p className="mt-2 text-3xl font-medium">{formatRate(rate.value)}</p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${
                          rate.stale
                            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        }`}
                      >
                        {rate.stale ? "кэш" : "daily"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-gray-600">{rate.note}</p>
                    <div className="mt-4 space-y-1 text-xs text-gray-700">
                      <p>Источник: {rate.sourceName}</p>
                      <p>Дата курса: {rate.effectiveDate}</p>
                      <p>Следующее обновление: {formatDateTime(rate.nextUpdateAt)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-relaxed text-gray-500">
                Реальные курсы валют пока не загрузились из официальных источников. Резервные значения не подставляются.
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-500" strokeWidth={1.5} />
                <h2 className="text-xl font-medium">Прайс тарифов</h2>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">
                Цены можно менять в рублях и тенге. Курсы выше подтягиваются из официальных источников и обновляются раз в день.
              </p>

              {pricing.plans.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                  {pricing.plans.map((plan, index) => (
                    <div key={plan.id} className={`p-4 ${index !== pricing.plans.length - 1 ? "border-b border-white/10" : ""}`}>
                      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr] xl:items-center">
                        <div>
                          <h3 className="text-lg font-medium text-white">{plan.name}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-gray-500">{plan.description}</p>
                          <p className="mt-2 text-xs text-gray-600">
                            {formatNumber(plan.monthlyCredits)} кредитов · {formatNumber(plan.contextTokens)} контекст
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {plan.prices.map((price) => {
                            const key = priceKey(plan.id, price.country);
                            return (
                              <div key={key} className="rounded-2xl border border-white/10 bg-black p-3">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <span className="text-sm text-gray-400">
                                    {price.country === "KZ" ? "Казахстан" : "Россия"} · {price.provider}
                                  </span>
                                  <span className="text-xs text-gray-600">{price.currency}</span>
                                </div>
                                <div className="mb-3">
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                                      price.priceSource === "admin_fixed_rate"
                                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                        : "border-white/10 bg-white/[0.03] text-gray-500"
                                    }`}
                                  >
                                    {price.priceSource === "admin_fixed_rate" ? "ручная цена" : "базовая цена"}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    value={draftPrices[key] ?? ""}
                                    onChange={(event) =>
                                      setDraftPrices((current) => ({ ...current, [key]: event.target.value }))
                                    }
                                    inputMode="decimal"
                                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#050505] px-3 text-sm text-white outline-none transition-colors focus:border-white/25"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void savePrice(plan.id, price.country)}
                                    disabled={savingPrice === key}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                                    aria-label="Сохранить цену"
                                  >
                                    <Save className="h-4 w-4" strokeWidth={1.8} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black p-5 text-sm leading-relaxed text-gray-500">
                  Таблицы plans и plan_prices пока недоступны. После подключения API прайс создастся из базовых тарифов,
                  а ручные цены администратора будут использоваться в оплате для всех ролей.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
