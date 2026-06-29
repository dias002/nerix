import type { WalletBalance } from "@nomduchat/shared";
import type {
  CurrentSubscriptionApiResponse,
  LedgerApiEntry,
  PlanApiRecord,
  PlanId,
  SubscriptionCheckoutApiRecord,
  SubscriptionCheckoutApiResponse,
  SubscriptionCompleteApiResponse,
  UsageLimitsApiResponse,
} from "./index";
import { request } from "./transport";

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
