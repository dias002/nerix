import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CreditCard, TrendingDown, Wallet, Zap } from "lucide-react";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import {
  completeMockSubscription,
  createSubscriptionCheckout,
  getCurrentSubscription,
  getLedger,
  getPlans,
  getWallet,
  type CurrentSubscriptionApiResponse,
  type LedgerApiEntry,
  type PlanId,
  type PlanApiRecord,
} from "../api";

export default function Balance() {
  const { t } = useLanguage();
  const { refreshUser, user } = useAuth();
  const country = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("nerix-country") === "RU" ? "RU" : "KZ";
    }

    return user?.country === "RU" ? "RU" : "KZ";
  }, [user?.country]);
  const [wallet, setWallet] = useState<{ availableCredits: number; reservedCredits: number } | null>(null);
  const [ledger, setLedger] = useState<LedgerApiEntry[] | null>(null);
  const [plans, setPlans] = useState<PlanApiRecord[] | null>(null);
  const [currentSubscription, setCurrentSubscription] =
    useState<CurrentSubscriptionApiResponse["subscription"]>(null);
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);
  const [checkoutNoticePlanId, setCheckoutNoticePlanId] = useState<PlanId | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);

    Promise.all([getWallet(), getLedger(), getPlans(country), getCurrentSubscription()])
      .then(([walletResponse, ledgerResponse, plansResponse, subscriptionResponse]) => {
        if (!active) return;
        setWallet(walletResponse);
        setLedger(ledgerResponse.entries);
        setPlans(plansResponse.plans);
        setCurrentSubscription(subscriptionResponse.subscription);
      })
      .catch(() => {
        if (!active) return;
        setWallet(null);
        setLedger(null);
        setPlans(null);
        setCurrentSubscription(null);
        setLoadError("Не удалось загрузить реальные данные баланса и тарифов из API.");
      });

    return () => {
      active = false;
    };
  }, [country]);

  const capturedEntries = useMemo(
    () => ledger?.filter((entry) => entry.type === "capture") ?? [],
    [ledger]
  );
  const usageCredits = capturedEntries.reduce((total, entry) => total + Math.abs(entry.amountCredits), 0);
  const avgCost = capturedEntries.length > 0 ? Math.round(usageCredits / capturedEntries.length) : 0;

  const stats = [
    { label: t.balance.currentBalance, value: wallet ? formatCredits(wallet.availableCredits) : "—", icon: Wallet },
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
      note: translated?.note ?? plan.description,
    };
  });

  const handleSubscribe = async (planId: PlanId) => {
    setPendingPlanId(planId);

    try {
      const checkout = await createSubscriptionCheckout({
        planId,
        country,
      });

      if (!checkout.checkout.checkoutUrl.startsWith("nerix://mock-checkout")) {
        window.location.href = checkout.checkout.checkoutUrl;
        return;
      }

      const completed = await completeMockSubscription(checkout.checkout.id);
      setWallet(completed.wallet);
      setCurrentSubscription(completed.subscription);
      setCheckoutNoticePlanId(null);
      await refreshUser();
    } catch {
      setCurrentSubscription(null);
    } finally {
      setPendingPlanId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <div>
          <h2 className="text-2xl font-medium text-white">{t.balance.title}</h2>
          <p className="mt-2 text-gray-400">{t.balance.subtitle}</p>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{loadError}</div>
        ) : null}

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

        <section className="space-y-4">
          <h3 className="text-lg font-medium text-white">{t.balance.packagesTitle}</h3>
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
                  <div className="mt-2 text-sm text-gray-400">{pack.amount}</div>
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
            )) : (
              <div className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5 text-sm text-gray-500 md:col-span-2 xl:col-span-4">
                Тарифы загрузятся из API.
              </div>
            )}
          </div>
        </section>

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

function formatPrice(amountMinor: number, currency: "KZT" | "RUB") {
  const amount = amountMinor / 100;
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(amount);

  return `${formatted} ${currency === "KZT" ? "₸" : "₽"}`;
}
