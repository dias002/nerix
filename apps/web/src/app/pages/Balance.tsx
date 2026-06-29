import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertCircle, CreditCard, ExternalLink, FileText, Mail, TrendingDown, Wallet, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import {
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

export default function Balance() {
  const { t } = useLanguage();
  const navigate = useNavigate();
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

  const capturedEntries = useMemo(
    () => ledger?.filter((entry) => entry.type === "capture") ?? [],
    [ledger]
  );
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
    ledger && ledger.length > 0
      ? ledger.slice(0, 6).map((entry) => ({
          label: ledgerLabel(entry.type),
          value: `${entry.amountCredits > 0 ? "+" : ""}${formatCredits(entry.amountCredits)}`,
          date: formatLedgerDate(entry.createdAt),
        }))
      : [];
  const translatedPlanIds: PlanId[] = ["base", "ultra", "pro", "business"];
  const translatedPackages = t.balance.packages.map((pack, index) => ({
    id: translatedPlanIds[index] ?? "base",
    ...pack,
  }));
  const translationById = new Map(translatedPackages.map((pack) => [pack.id, pack]));
  const subscriptionPackages = (plans ?? []).map((plan) => {
    const translated = translationById.get(plan.id);
    return {
      id: plan.id,
      name: translated?.name ?? plan.name,
      amount: translated?.amount ?? plan.description,
      price: formatPrice(plan.price.amountMinor, plan.price.currency),
      credits: plan.monthlyCredits,
      note: translated?.note ?? plan.description,
    };
  });

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

      if (!checkout.checkout.checkoutUrl.startsWith("nomduchat://mock-checkout")) {
        window.location.href = checkout.checkout.checkoutUrl;
        return;
      }

      const completed = await completeMockSubscription(checkout.checkout.id);
      setWallet(completed.wallet);
      setCurrentSubscription(completed.subscription);
      setCheckoutNoticePlanId(null);
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

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <div>
          <h2 className="text-2xl font-medium text-white">{t.balance.title}</h2>
          <p className="mt-2 text-gray-400">
            {isAuthenticated
              ? t.balance.subtitle
              : "Выберите тариф, чтобы открыть расширенные лимиты, видео, песни и бизнес-возможности."}
          </p>
        </div>

        {isAuthenticated ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5"
              >
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
                  <stat.icon className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <div className="text-3xl font-medium text-white">{stat.value}</div>
                <div className="mt-2 text-sm text-gray-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 text-sm leading-relaxed text-gray-400">
            Аккаунт понадобится на последнем шаге оплаты: так подписка, кредиты и чеки будут привязаны к вашему email.
            <Link to="/auth?mode=register&returnTo=%2Fworkspace%2Fbalance" state={{ from: "/workspace/balance" }} className="ml-1 text-white underline-offset-4 hover:underline">
              Создать аккаунт
            </Link>
          </div>
        )}

        <section className="space-y-4">
          <h3 className="text-lg font-medium text-white">{t.balance.packagesTitle}</h3>
          {checkoutError ? (
            <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-100/80">
              {checkoutError}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {subscriptionPackages.length > 0 ? subscriptionPackages.map((pack, index) => (
              <motion.div
                key={pack.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="flex min-h-52 flex-col rounded-2xl border border-white/10 bg-[#0D0D0D] p-5"
              >
                <div className="flex-1">
                  <h4 className="text-lg font-medium text-white">{pack.name}</h4>
                  <div className="mt-4 text-2xl font-medium text-white">{pack.price}</div>
                  <div className="mt-2 text-sm text-gray-400">{formatCredits(pack.credits)} nomduchat-кредитов / месяц</div>
                  <div className="mt-1 text-sm text-gray-500">{pack.amount}</div>
                  <p className="mt-4 text-sm leading-relaxed text-gray-500">{pack.note}</p>
                  {checkoutNoticePlanId === pack.id ? (
                    <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-gray-400">
                      {t.balance.checkoutCreated}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleSubscribe(pack.id)}
                  disabled={pendingPlanId === pack.id || currentSubscription?.planId === pack.id || checkoutNoticePlanId === pack.id}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" strokeWidth={1.8} />
                  {currentSubscription?.planId === pack.id
                    ? t.balance.activePlan
                    : checkoutNoticePlanId === pack.id
                      ? t.balance.pendingPlan
                      : t.balance.topUp}
                </button>
              </motion.div>
            )) : plans === null ? (
              <div className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5 text-sm text-gray-500 md:col-span-2 xl:col-span-4">
                Тарифы пока не загружены.
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5 text-sm text-gray-500 md:col-span-2 xl:col-span-4">
                Список тарифов пуст.
              </div>
            ) : null}
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
            <a
              href="mailto:admin@nomduchat.com?subject=Вопрос%20по%20оплате%20nomduchat"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <Mail className="h-4 w-4" strokeWidth={1.7} />
              Поддержка
            </a>
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
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
                    >
                      Продолжить оплату
                      <ExternalLink className="h-4 w-4" strokeWidth={1.7} />
                    </a>
                  ) : null}
                  <a
                    href={`mailto:admin@nomduchat.com?subject=${encodeURIComponent(`Платеж ${checkout.providerCheckoutId}`)}&body=${encodeURIComponent(
                      `Здравствуйте. Нужна помощь по платежу ${checkout.providerCheckoutId}. Тариф: ${checkout.planId}. Статус: ${checkout.status}.`
                    )}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.7} />
                    Написать
                  </a>
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
          <h3 className="text-lg font-medium text-white">{t.balance.activityTitle}</h3>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]">
            {activity.length > 0 ? activity.map((item, index) => (
              <div
                key={`${item.label}-${item.date}`}
                className={`flex items-center justify-between gap-4 p-4 ${
                  index !== activity.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-gray-600">{item.date}</div>
                </div>
                <div className={`text-sm font-medium ${item.value.startsWith("+") ? "text-white" : "text-gray-500"}`}>
                  {item.value}
                </div>
              </div>
            )) : (
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

function formatPrice(amountMinor: number, currency: "KZT" | "RUB") {
  const amount = amountMinor / 100;
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${formatted} ${currency === "KZT" ? "₸" : "₽"}`;
}
