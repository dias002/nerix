import type { CountryCode } from "@nomduchat/shared";
import type { WalletBalance } from "@nomduchat/shared";

export type SubscriptionCountry = Extract<CountryCode, "KZ" | "RU">;
export type PaymentProviderCode = "kaspi" | "yookassa";
export type PlanId = "base" | "ultra" | "pro" | "business";
export type SubscriptionStatus = "pending" | "active" | "cancelled" | "payment_failed";
export type CheckoutStatus = "pending" | "completed" | "cancelled" | "failed";
export type ProviderPaymentStatus = "succeeded" | "failed" | "cancelled" | "pending" | "ignored";
export type PriceSource = "mashagpt_benchmark_draft" | "admin_fixed_rate";

export type PlanPrice = {
  country: SubscriptionCountry;
  provider: PaymentProviderCode;
  currency: "KZT" | "RUB";
  amountMinor: number;
  priceSource: PriceSource;
};

export type SubscriptionPlan = {
  id: PlanId;
  name: string;
  monthlyCredits: number;
  contextTokens: number;
  description: string;
  enabled: boolean;
  prices: PlanPrice[];
};

export type PublicSubscriptionPlan = Omit<SubscriptionPlan, "prices"> & {
  price: PlanPrice;
};

export type SubscriptionCheckoutRecord = {
  id: string;
  userId: string;
  planId: PlanId;
  country: SubscriptionCountry;
  provider: PaymentProviderCode;
  currency: "KZT" | "RUB";
  amountMinor: number;
  status: CheckoutStatus;
  creditsGranted: boolean;
  providerCheckoutId: string;
  checkoutUrl: string;
  customerEmail: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionRecord = {
  id: string;
  userId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  country: SubscriptionCountry;
  provider: PaymentProviderCode;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionCompletion = {
  checkout: SubscriptionCheckoutRecord;
  subscription: SubscriptionRecord;
  shouldGrantCredits: boolean;
};

export type CheckoutPaymentEvent = {
  eventType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export type ProviderCheckoutEventInput = CheckoutPaymentEvent & {
  provider: PaymentProviderCode;
  providerCheckoutId: string;
};

export type CompleteSubscriptionResult = {
  checkout: SubscriptionCheckoutRecord;
  subscription: SubscriptionRecord;
  wallet: WalletBalance;
};
