import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Mail,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import PageHeader from "../components/workspace/PageHeader";
import { reachAnalyticsGoal } from "../analytics";
import {
  cancelCurrentSubscription,
  completeMockSubscription,
  createSubscriptionCheckout,
  getCurrentSubscription,
  getLedger,
  getPlans,
  getSubscriptionCheckouts,
  getWallet,
  toPublicApiError,
  type CurrentSubscriptionApiResponse,
  type LedgerApiEntry,
  type PlanId,
  type PlanApiRecord,
  type SubscriptionCheckoutApiRecord,
} from "../api";

const autoRenewalStorageKey = "nomduchat-auto-renewal-enabled";
type LedgerFilter = "all" | "topup" | "capture" | "reserve" | "refund";

const ledgerFilters: Array<{ id: LedgerFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "topup", label: "Пополнения" },
  { id: "capture", label: "Списания" },
  { id: "reserve", label: "Резервы" },
  { id: "refund", label: "Возвраты" },
];

export default function Balance() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, refreshUser, user } = useAuth();
  const country = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("nomduchat-country") === "RU" ? "RU" : "KZ";
    }

    return user?.country === "RU" ? "RU" : "KZ";
  }, [user?.country]);
  const [wallet, setWallet] = useState<{ availableCredits: number; reservedCredits: number } | null>(null);
  const [ledger, setLedger] = useState<LedgerApiEntry[] | null>(null);
  const [checkouts, setCheckouts] = useState<SubscriptionCheckoutApiRecord[] | null>(null);
  const [plans, setPlans] = useState<PlanApiRecord[] | null>(null);
  const [currentSubscription, setCurrentSubscription] =
    useState<CurrentSubscriptionApiResponse["subscription"]>(null);
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);
  const [checkoutNoticePlanId, setCheckoutNoticePlanId] = useState<PlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [autoRenewalEnabled, setAutoRenewalEnabled] = useState(() => readAutoRenewalEnabled());
  const [autoRenewalBusy, setAutoRenewalBusy] = useState(false);
  const [autoRenewalError, setAutoRenewalError] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");

  useEffect(() => {
    let active = true;

    getPlans(country)
      .then((response) => {
        if (active) setPlans(response.plans);
      })
      .catch(() => {
        if (active) setPlans(null);
      });

    if (!isAuthenticated) {
      setWallet(null);
      setLedger([]);
      setCurrentSubscription(null);
      setCheckouts([]);
      return () => {
        active = false;
      };
    }

    Promise.allSettled([getWallet(), getLedger(), getCurrentSubscription(), getSubscriptionCheckouts()]).then((results) => {
      if (!active) return;

      const walletResult = results[0];
      const ledgerResult = results[1];
      const subscriptionResult = results[2];
      const checkoutsResult = results[3];

      setWallet(walletResult.status === "fulfilled" ? walletResult.value : null);
      setLedger(ledgerResult.status === "fulfilled" ? ledgerResult.value.entries : null);
      setCurrentSubscription(subscriptionResult.status === "fulfilled" ? subscriptionResult.value.subscription : null);
      setCheckouts(checkoutsResult.status === "fulfilled" ? checkoutsResult.value.checkouts : null);
    });

    return () => {
      active = false;
    };
  }, [country, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentSubscription) return;

    const enabled = currentSubscription.status === "active" && !currentSubscription.cancelAtPeriodEnd;
    setAutoRenewalEnabled(enabled);
    window.localStorage.setItem(autoRenewalStorageKey, String(enabled));
  }, [currentSubscription?.cancelAtPeriodEnd, currentSubscription?.id, currentSubscription?.status, isAuthenticated]);

  useEffect(() => {
    if (location.hash !== "#token-history") return;
    window.setTimeout(() => {
      document.getElementById("token-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [location.hash]);

  const capturedEntries = useMemo(
    () => ledger?.filter((entry) => entry.type === "capture") ?? [],
    [ledger]
  );
  const filteredLedger = useMemo(() => {
    if (!ledger) return null;
    if (ledgerFilter === "all") return ledger;
    return ledger.filter((entry) => entry.type === ledgerFilter);
  }, [ledger, ledgerFilter]);
  const usageCredits = capturedEntries.reduce((total, entry) => total + Math.abs(entry.amountCredits), 0);
  const avgCost = capturedEntries.length > 0 ? Math.round(usageCredits / capturedEntries.length) : 0;
  const activePlan = plans?.find((plan) => plan.id === currentSubscription?.planId) ?? null;
  const displayAvailableCredits =
    wallet && activePlan ? Math.min(wallet.availableCredits, activePlan.monthlyCredits) : wallet?.availableCredits;

  const stats = [
    { label: t.balance.currentBalance, value: displayAvailableCredits !== undefined ? formatCredits(displayAvailableCredits) : "—", icon: Wallet },
    { label: t.balance.usage, value: ledger ? formatCredits(usageCredits) : "—", icon: TrendingDown },
    { label: t.balance.avgCost, value: ledger ? formatCredits(capturedEntries.length > 0 ? avgCost : 0) : "—", icon: Zap },
  ];

  const activity =
    filteredLedger && filteredLedger.length > 0
      ? filteredLedger.slice(0, 12).map((entry) => ({
          id: entry.id,
          label: ledgerLabel(entry.type),
          value: `${entry.amountCredits > 0 ? "+" : ""}${formatCredits(entry.amountCredits)}`,
          date: formatLedgerDate(entry.createdAt),
          balance: formatCredits(entry.balanceAfterCredits),
          reference: entry.referenceId ?? entry.referenceType ?? "—",
        }))
      : [];
  const translatedPlanIds: PlanId[] = ["base", "ultra", "pro", "business"];
  const translatedPackages = t.balance.packages.map((pack, index) => ({
    id: translatedPlanIds[index] ?? "base",
    ...pack,
  }));
  const translationById = new Map(translatedPackages.map((pack) => [pack.id, pack]));
  const plansForDisplay = plans && plans.length > 0 ? plans : fallbackPlans(country);
  const showingFallbackPlans = !plans || plans.length === 0;
  const subscriptionPackages = plansForDisplay.map((plan) => {
    const translated = translationById.get(plan.id);
    return {
      id: plan.id,
      name: translated?.name ?? plan.name,
      amount: translated?.amount ?? plan.description,
      price: formatPrice(plan.price.amountMinor, plan.price.currency),
      credits: plan.monthlyCredits,
      note: translated?.note ?? plan.description,
      examples: getPlanExamples(plan.id, plan.monthlyCredits),
    };
  });
  const currentPlanPackage = subscriptionPackages.find((pack) => pack.id === currentSubscription?.planId) ?? null;
  const currentLimit = activePlan?.monthlyCredits ?? wallet?.availableCredits ?? 0;
  const usagePercent = currentLimit > 0 ? Math.min(100, Math.round((usageCredits / currentLimit) * 100)) : 0;

  const handleSubscribe = async (planId: PlanId) => {
    if (!isAuthenticated) {
      const returnTo = "/workspace/balance";
      navigate(`/auth?mode=register&returnTo=${encodeURIComponent(returnTo)}`, { state: { from: returnTo } });
      return;
    }

    setPendingPlanId(planId);
    setCheckoutError(null);

    if (country === "RU" && !user?.email) {
      setPendingPlanId(null);
      setCheckoutError("Для оплаты через YooKassa нужен email в профиле. Добавьте email или войдите в аккаунт с email.");
      return;
    }

    try {
      const checkout = await createSubscriptionCheckout({
        planId,
        country,
        customerEmail: user?.email ?? undefined,
      });
      reachAnalyticsGoal("subscription_checkout", {
        planId: checkout.checkout.planId,
        country: checkout.checkout.country,
        provider: checkout.checkout.provider,
        amountMinor: checkout.checkout.amountMinor,
        currency: checkout.checkout.currency,
      });

      if (!checkout.checkout.checkoutUrl.startsWith("nomduchat://mock-checkout")) {
        window.location.href = checkout.checkout.checkoutUrl;
        return;
      }

      const completed = await completeMockSubscription(checkout.checkout.id);
      setWallet(completed.wallet);
      setCurrentSubscription(completed.subscription);
      setCheckoutNoticePlanId(null);
      reachAnalyticsGoal("subscription_paid", {
        planId: completed.checkout.planId,
        country: completed.checkout.country,
        provider: completed.checkout.provider,
        amountMinor: completed.checkout.amountMinor,
        currency: completed.checkout.currency,
      });
      const latestCheckouts = await getSubscriptionCheckouts().catch(() => null);
      if (latestCheckouts) setCheckouts(latestCheckouts.checkouts);
      await refreshUser();
    } catch (error) {
      setCurrentSubscription(null);
      setCheckoutError(formatCheckoutError(error));
    } finally {
      setPendingPlanId(null);
    }
  };

  const toggleAutoRenewal = async () => {
    setAutoRenewalError(null);

    if (!isAuthenticated) {
      setAutoRenewalEnabled((current) => {
        const next = !current;
        window.localStorage.setItem(autoRenewalStorageKey, String(next));
        return next;
      });
      return;
    }

    if (!autoRenewalEnabled) {
      if (currentSubscription?.cancelAtPeriodEnd || currentSubscription?.status === "cancelled") {
        setAutoRenewalError("Повторное включение доступно через оформление нового периода подписки.");
        return;
      }

      setAutoRenewalEnabled(true);
      window.localStorage.setItem(autoRenewalStorageKey, "true");
      return;
    }

    if (!currentSubscription || currentSubscription.status !== "active") {
      setAutoRenewalEnabled(false);
      window.localStorage.setItem(autoRenewalStorageKey, "false");
      return;
    }

    setAutoRenewalBusy(true);

    try {
      const response = await cancelCurrentSubscription();
      setCurrentSubscription(response.subscription);
      setAutoRenewalEnabled(false);
      window.localStorage.setItem(autoRenewalStorageKey, "false");
      await refreshUser();
    } catch (error) {
      setAutoRenewalError(toPublicApiError(error, "Не удалось отключить автопродление. Попробуйте позже."));
    } finally {
      setAutoRenewalBusy(false);
    }
  };

  return (
    <div className="ns-page-scroll">
      <div className="ns-page space-y-8">
        <PageHeader
          overline="Баланс"
          title={t.balance.title}
          subtitle={isAuthenticated ? t.balance.subtitle : "Выберите тариф, чтобы открыть расширенные лимиты, видео, песни и бизнес-возможности."}
          actions={
            <Link to="/support" className="nd-secondary-action inline-flex h-11 items-center justify-center gap-2 px-5 text-sm">
              <Mail className="h-4 w-4" strokeWidth={1.7} />
              Поддержка
            </Link>
          }
        />

        {isAuthenticated ? (
          <div className="ns-kpi-grid">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="ns-metric-card p-5"
                data-primary={index === 0}
              >
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]">
                  <stat.icon className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <div className="text-3xl font-medium text-[var(--text-primary)]">{stat.value}</div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="ns-surface-panel p-5 text-sm leading-relaxed text-[var(--text-secondary)]">
            Аккаунт понадобится на последнем шаге оплаты: так подписка, кредиты и чеки будут привязаны к вашему email.
            <Link to="/auth?mode=register&returnTo=%2Fworkspace%2Fbalance" state={{ from: "/workspace/balance" }} className="ml-1 text-[var(--text-primary)] underline-offset-4 hover:underline">
              Создать аккаунт
            </Link>
          </div>
        )}

        {isAuthenticated ? (
          <section className="ns-surface-panel p-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-center">
              <div>
                <p className="ns-overline">Текущий план</p>
                <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">
                  {currentPlanPackage?.name ?? "Подписка не активна"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {currentPlanPackage
                    ? `${formatCredits(currentPlanPackage.credits)} кредитов в месяц. Расход показывается по фактическим операциям.`
                    : "Оформите тариф, чтобы открыть расширенные лимиты, медиа и бизнес-возможности."}
                </p>
                <div className="mt-5 ns-usage-bar">
                  <span style={{ width: `${usagePercent}%` }} />
                </div>
                <div className="mt-2 flex justify-between gap-3 text-xs text-[var(--text-tertiary)]">
                  <span>Использовано: {formatCredits(usageCredits)}</span>
                  <span>{usagePercent}%</span>
                </div>
              </div>
              <div className="rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-1)] p-4">
                <div className="text-sm text-[var(--text-secondary)]">Автопродление</div>
                <div className="mt-2 text-xl font-medium text-[var(--text-primary)]">
                  {autoRenewalEnabled ? "Включено" : "Отключено"}
                </div>
                <button
                  type="button"
                  onClick={toggleAutoRenewal}
                  disabled={autoRenewalBusy}
                  className="nd-secondary-action mt-4 inline-flex h-10 w-full items-center justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {autoRenewalBusy ? "Сохраняю..." : autoRenewalEnabled ? "Отключить" : "Включить"}
                </button>
              </div>
            </div>
            {autoRenewalError ? (
              <p className="mt-4 rounded-[var(--radius-input)] border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-100/80">
                {autoRenewalError}
              </p>
            ) : null}
          </section>
        ) : null}

        <section id="token-history" className="scroll-mt-8 space-y-4">
          <h3 className="text-lg font-medium text-[var(--text-primary)]">{t.balance.packagesTitle}</h3>
          {showingFallbackPlans ? (
            <p className="rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              Показываем базовые тарифы из локального каталога. Актуальная оплата и статус подтянутся после ответа API.
            </p>
          ) : null}
          {checkoutError ? (
            <p className="rounded-[var(--radius-input)] border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-100/80">
              {checkoutError}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {subscriptionPackages.map((pack, index) => (
              <motion.div
                key={pack.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="ns-price-card flex min-h-52 flex-col p-5"
                data-current={currentSubscription?.planId === pack.id}
                data-recommended={pack.id === "pro"}
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-lg font-medium text-[var(--text-primary)]">{pack.name}</h4>
                    {currentSubscription?.planId === pack.id ? (
                      <span className="rounded-full border border-[var(--line-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">текущий</span>
                    ) : pack.id === "pro" ? (
                      <span className="rounded-full border border-[var(--line-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">лучший</span>
                    ) : null}
                  </div>
                  <div className="mt-4 text-2xl font-medium text-[var(--text-primary)]">{pack.price}</div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">{formatCredits(pack.credits)} кредитов / месяц</div>
                  <div className="mt-1 text-sm text-[var(--text-tertiary)]">{pack.amount}</div>
                  <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{pack.note}</p>
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Примеры в тарифе</div>
                    <ul className="space-y-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {pack.examples.map((example) => (
                        <li key={example}>• {example}</li>
                      ))}
                    </ul>
                  </div>
                  {checkoutNoticePlanId === pack.id ? (
                    <p className="mt-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {t.balance.checkoutCreated}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleSubscribe(pack.id)}
                  disabled={pendingPlanId === pack.id || currentSubscription?.planId === pack.id || checkoutNoticePlanId === pack.id}
                  className="nd-primary-action mt-5 inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-medium disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" strokeWidth={1.8} />
                  {currentSubscription?.planId === pack.id
                    ? t.balance.activePlan
                    : checkoutNoticePlanId === pack.id
                      ? t.balance.pendingPlan
                      : t.balance.topUp}
                </button>
                <p className="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
                  При оплате вы принимаете{" "}
                  <Link to="/legal/terms" className="text-[var(--text-secondary)] underline-offset-4 hover:underline">
                    условия сервиса
                  </Link>{" "}
                  и{" "}
                  <Link to="/legal/pricing" className="text-[var(--text-secondary)] underline-offset-4 hover:underline">
                    каталог услуг
                  </Link>
                  .
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {isAuthenticated ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">Платежи и чеки</h3>
              <p className="mt-1 text-sm text-gray-500">
                Здесь видны созданные оплаты, их статус и данные для поддержки.
              </p>
            </div>
            <Link
              to="/support"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <Mail className="h-4 w-4" strokeWidth={1.7} />
              Поддержка
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
            {checkouts && checkouts.length > 0 ? checkouts.slice(0, 6).map((checkout, index) => (
              <div
                key={checkout.id}
                className={`grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center ${
                  index !== Math.min(checkouts.length, 6) - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{planLabel(checkout.planId)}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${checkoutStatusClass(checkout.status)}`}>
                      {checkoutStatusLabel(checkout.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{formatPrice(checkout.amountMinor, checkout.currency)}</span>
                    <span>{providerLabel(checkout.provider)}</span>
                    <span>{formatCheckoutDate(checkout.createdAt)}</span>
                    <span className="max-w-full truncate">ID: {checkout.providerCheckoutId}</span>
                  </div>
                  {checkout.status === "completed" ? (
                    <div className="mt-3 inline-flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-gray-400">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
                      Чек формирует платежный провайдер и отправляет на контакт покупателя.
                    </div>
                  ) : checkout.status === "failed" || checkout.status === "cancelled" ? (
                    <div className="mt-3 inline-flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-100/80">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
                      Оплата не завершена. Можно создать новый платеж или написать в поддержку с ID операции.
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {checkout.status === "pending" && !checkout.checkoutUrl.startsWith("nomduchat://mock-checkout") ? (
                    <a
                      href={checkout.checkoutUrl}
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
                    >
                      Продолжить оплату
                      <ExternalLink className="h-4 w-4" strokeWidth={1.7} />
                    </a>
                  ) : null}
                  {checkout.status === "failed" || checkout.status === "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => handleSubscribe(checkout.planId)}
                      disabled={pendingPlanId === checkout.planId}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CreditCard className="h-4 w-4" strokeWidth={1.7} />
                      {pendingPlanId === checkout.planId ? "Создаю..." : "Новый платеж"}
                    </button>
                  ) : null}
                  <Link
                    to="/support"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.7} />
                    Поддержка
                  </Link>
                </div>
              </div>
            )) : checkouts === null ? (
              <div className="p-4 text-sm text-gray-500">История платежей пока не загружена.</div>
            ) : (
              <div className="p-4 text-sm text-gray-500">Платежей пока нет.</div>
            )}
          </div>
        </section>
        ) : null}

        {isAuthenticated ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-medium text-white">История токенов</h3>
              <p className="mt-1 text-sm text-gray-500">
                Пополнения, резервы, списания и возвраты по вашему балансу.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ledgerFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setLedgerFilter(filter.id)}
                  className={`h-9 rounded-full border px-3 text-sm transition-colors ${
                    ledgerFilter === filter.id
                      ? "border-white/25 bg-white text-black"
                      : "border-white/10 bg-black text-gray-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => downloadLedgerCsv(filteredLedger ?? [])}
                disabled={!filteredLedger?.length}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
              >
                <Download className="h-4 w-4" strokeWidth={1.7} />
                CSV
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
            {activity.length > 0 ? activity.map((item, index) => (
              <div
                key={item.id}
                className={`grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center ${
                  index !== activity.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    <span>{item.date}</span>
                    <span>Баланс после: {item.balance}</span>
                    <span className="max-w-full truncate">Связь: {item.reference}</span>
                  </div>
                </div>
                <div className={`text-sm font-medium md:text-right ${item.value.startsWith("+") ? "text-white" : "text-gray-500"}`}>
                  {item.value}
                </div>
              </div>
            )) : filteredLedger === null ? (
              <div className="p-4 text-sm text-gray-500">История токенов пока не загружена.</div>
            ) : (
              <div className="p-4 text-sm text-gray-500">{t.balance.emptyActivity}</div>
            )}
          </div>
        </section>
        ) : null}
      </div>
    </div>
  );
}

function formatCredits(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatLedgerDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function ledgerLabel(type: string) {
  switch (type) {
    case "topup":
      return "Пополнение баланса";
    case "reserve":
      return "Резерв токенов";
    case "capture":
      return "Списание за запрос";
    case "refund":
      return "Возврат резерва";
    default:
      return "Операция";
  }
}

function planLabel(planId: PlanId) {
  const labels: Record<PlanId, string> = {
    base: "Easy Start",
    ultra: "Active Work",
    pro: "Team Mode",
    business: "Business Cabinet",
  };
  return labels[planId] ?? planId;
}

function getPlanExamples(planId: PlanId, credits: number) {
  const examples = [
    `до ${formatCredits(Math.max(1, Math.floor(credits / 25)))} текстовых запросов`,
    `до ${formatCredits(Math.max(1, Math.floor(credits / 220)))} изображений`,
    `до ${formatCredits(Math.max(1, Math.floor(credits / 1_200)))} коротких видео`,
    `до ${formatCredits(Math.max(1, Math.floor(credits / 700)))} песен или аудио-идей`,
    `до ${formatCredits(Math.max(1, Math.floor(credits / 1_800)))} avatar-video`,
  ];

  if (planId === "business") {
    return [...examples, "помощь с внедрением бизнес-сценариев"];
  }

  if (planId === "pro") {
    return [...examples, "регулярная генерация медиа для команды"];
  }

  return examples;
}

function providerLabel(provider: "kaspi" | "yookassa") {
  return provider === "kaspi" ? "Kaspi" : "YooKassa";
}

function checkoutStatusLabel(status: SubscriptionCheckoutApiRecord["status"]) {
  const labels: Record<SubscriptionCheckoutApiRecord["status"], string> = {
    pending: "Ожидает оплаты",
    completed: "Оплачено",
    cancelled: "Отменено",
    failed: "Ошибка",
  };
  return labels[status];
}

function checkoutStatusClass(status: SubscriptionCheckoutApiRecord["status"]) {
  if (status === "completed") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (status === "pending") return "border-white/10 bg-white/[0.05] text-gray-300";
  return "border-red-400/25 bg-red-400/10 text-red-100";
}

function formatCheckoutDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCheckoutError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/email|required for YooKassa receipt/i.test(message)) {
    return "Для оплаты через YooKassa нужен email в профиле. Добавьте email или войдите в аккаунт с email.";
  }

  return toPublicApiError(error, "Оплата картой временно недоступна. Попробуйте позже.");
}

function downloadLedgerCsv(entries: LedgerApiEntry[]) {
  if (!entries.length) return;

  const header = ["date", "type", "amountCredits", "balanceAfterCredits", "referenceType", "referenceId"];
  const rows = entries.map((entry) =>
    [
      entry.createdAt,
      entry.type,
      String(entry.amountCredits),
      String(entry.balanceAfterCredits),
      entry.referenceType ?? "",
      entry.referenceId ?? "",
    ].map(csvCell)
  );
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `nomduchat-token-history-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatPrice(amountMinor: number, currency: "KZT" | "RUB") {
  const amount = amountMinor / 100;
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${formatted} ${currency === "KZT" ? "₸" : "₽"}`;
}

function readAutoRenewalEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(autoRenewalStorageKey) !== "false";
}

function fallbackPlans(country: "KZ" | "RU"): PlanApiRecord[] {
  const provider = country === "KZ" ? "kaspi" : "yookassa";
  const currency = country === "KZ" ? "KZT" : "RUB";
  const amounts: Record<"KZ" | "RU", Record<PlanId, number>> = {
    KZ: {
      base: 5_990_00,
      ultra: 11_990_00,
      pro: 119_990_00,
      business: 249_990_00,
    },
    RU: {
      base: 990_00,
      ultra: 1_990_00,
      pro: 19_990_00,
      business: 41_690_00,
    },
  };

  return [
    fallbackPlan("base", "Easy Start", 2_000, 8_000, "For steady everyday work."),
    fallbackPlan("ultra", "Active Work", 5_000, 32_000, "For more active work across chat, documents, and code."),
    fallbackPlan("pro", "Team Mode", 20_000, 64_000, "For teams and larger business tasks."),
    fallbackPlan("business", "Business Cabinet", 50_000, 128_000, "Business workspace with roles, CRM analytics, and company context."),
  ];

  function fallbackPlan(
    id: PlanId,
    name: string,
    monthlyCredits: number,
    contextTokens: number,
    description: string,
  ): PlanApiRecord {
    return {
      id,
      name,
      monthlyCredits,
      contextTokens,
      description,
      enabled: true,
      price: {
        country,
        provider,
        currency,
        amountMinor: amounts[country][id],
        priceSource: "mashagpt_benchmark_draft",
      },
    };
  }
}
