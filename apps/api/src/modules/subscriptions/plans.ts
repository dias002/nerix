import type { PaymentProviderCode, PlanId, SubscriptionCountry, SubscriptionPlan } from "./subscription.types.js";

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "base",
    name: "Easy Start",
    monthlyCredits: 20_000_000,
    contextTokens: 28_000,
    description: "For steady everyday work.",
    enabled: true,
    prices: [
      price("RU", "yookassa", "RUB", 990_00),
      price("KZ", "kaspi", "KZT", 5_990_00),
    ],
  },
  {
    id: "ultra",
    name: "Active Work",
    monthlyCredits: 50_000_000,
    contextTokens: 100_000,
    description: "For more active work across chat, documents, and code.",
    enabled: true,
    prices: [
      price("RU", "yookassa", "RUB", 1_990_00),
      price("KZ", "kaspi", "KZT", 11_990_00),
    ],
  },
  {
    id: "pro",
    name: "Team Mode",
    monthlyCredits: 700_000_000,
    contextTokens: 200_000,
    description: "For teams and larger business tasks.",
    enabled: true,
    prices: [
      price("RU", "yookassa", "RUB", 19_990_00),
      price("KZ", "kaspi", "KZT", 119_990_00),
    ],
  },
  {
    id: "business",
    name: "Business Cabinet",
    monthlyCredits: 1_500_000_000,
    contextTokens: 400_000,
    description: "Business workspace with up to 5 employees, roles, CRM analytics, and a company assistant.",
    enabled: true,
    prices: [
      price("RU", "yookassa", "RUB", 49_990_00),
      price("KZ", "kaspi", "KZT", 249_990_00),
    ],
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
