import type { PaymentProviderCode, PlanId, SubscriptionCountry, SubscriptionPlan } from "./subscription.types.js";

const rubPerKzt = 1 / 6;

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "base",
    name: "Easy Start",
    monthlyCredits: 2_000,
    contextTokens: 8_000,
    description: "For steady everyday work.",
    enabled: true,
    prices: pricesFromKzt(5_990_00),
  },
  {
    id: "ultra",
    name: "Active Work",
    monthlyCredits: 5_000,
    contextTokens: 32_000,
    description: "For more active work across chat, documents, and code.",
    enabled: true,
    prices: pricesFromKzt(11_990_00),
  },
  {
    id: "pro",
    name: "Team Mode",
    monthlyCredits: 20_000,
    contextTokens: 64_000,
    description: "For teams and larger business tasks.",
    enabled: true,
    prices: pricesFromKzt(119_990_00),
  },
  {
    id: "business",
    name: "Business Cabinet",
    monthlyCredits: 50_000,
    contextTokens: 128_000,
    description: "Business workspace with up to 5 employees, roles, CRM analytics, and a company assistant.",
    enabled: true,
    prices: pricesFromKzt(249_990_00),
  },
];

export function findPlan(planId: string) {
  return subscriptionPlans.find((plan) => plan.id === planId && plan.enabled) ?? null;
}

export function findPlanPrice(plan: SubscriptionPlan, country: SubscriptionCountry) {
  return plan.prices.find((price) => price.country === country) ?? null;
}

export function providerForCountry(country: SubscriptionCountry): PaymentProviderCode {
  return country === "KZ" ? "kaspi" : "yookassa";
}

function pricesFromKzt(amountMinor: number) {
  return [
    price("KZ", "kaspi", "KZT", amountMinor),
    price("RU", "yookassa", "RUB", toRubMinor(amountMinor)),
  ];
}

function toRubMinor(kztAmountMinor: number) {
  const convertedMinor = kztAmountMinor * rubPerKzt;
  return roundRubPriceMinor(convertedMinor);
}

function roundRubPriceMinor(amountMinor: number) {
  const amountMajor = amountMinor / 100;
  const roundedMajor = Math.max(90, Math.floor(amountMajor / 100) * 100 + 90);
  return roundedMajor * 100;
}

function price(
  country: SubscriptionCountry,
  provider: PaymentProviderCode,
  currency: "KZT" | "RUB",
  amountMinor: number
) {
  return {
    country,
    provider,
    currency,
    amountMinor,
    priceSource: "mashagpt_benchmark_draft" as const,
  };
}

export function isPlanId(value: string): value is PlanId {
  return value === "base" || value === "ultra" || value === "pro" || value === "business";
}

export function isSubscriptionCountry(value: string): value is SubscriptionCountry {
  return value === "KZ" || value === "RU";
}
