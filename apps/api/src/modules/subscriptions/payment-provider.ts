import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import type { PaymentProviderCode, PlanPrice, SubscriptionPlan } from "./subscription.types.js";

export type CreateCheckoutInput = {
  userId: string;
  plan: SubscriptionPlan;
  price: PlanPrice;
};

export type ProviderCheckout = {
  providerCheckoutId: string;
  checkoutUrl: string;
};

export interface SubscriptionPaymentProvider {
  code: PaymentProviderCode;
  createCheckout(input: CreateCheckoutInput): Promise<ProviderCheckout>;
}

export class MockSubscriptionPaymentProvider implements SubscriptionPaymentProvider {
  constructor(readonly code: PaymentProviderCode) {}

  async createCheckout(input: CreateCheckoutInput) {
    return {
      providerCheckoutId: `mock_${randomUUID()}`,
      checkoutUrl: `nomduchat://mock-checkout/${this.code}/${input.plan.id}`,
    };
  }
}

export class KaspiSubscriptionPaymentProvider implements SubscriptionPaymentProvider {
  readonly code = "kaspi" as const;

  async createCheckout(input: CreateCheckoutInput) {
    const providerCheckoutId = `kaspi_${randomUUID()}`;

    if (!config.KASPI_CHECKOUT_URL) {
      if (!config.PAYMENT_MOCK_CHECKOUT_ENABLED) {
        throw new Error("KASPI_CHECKOUT_URL is required for paid KZ checkout.");
      }

      return new MockSubscriptionPaymentProvider(this.code).createCheckout(input);
    }

    const url = new URL(config.KASPI_CHECKOUT_URL);
    url.searchParams.set("providerCheckoutId", providerCheckoutId);
    url.searchParams.set("planId", input.plan.id);
    url.searchParams.set("userId", input.userId);
    url.searchParams.set("amountMinor", String(input.price.amountMinor));
    url.searchParams.set("currency", input.price.currency);

    return {
      providerCheckoutId,
      checkoutUrl: url.toString(),
    };
  }
}

type YooKassaPaymentResponse = {
  id: string;
  confirmation?: {
    confirmation_url?: string;
  };
};

export class YooKassaSubscriptionPaymentProvider implements SubscriptionPaymentProvider {
  readonly code = "yookassa" as const;

  async createCheckout(input: CreateCheckoutInput) {
    if (!config.YOOKASSA_SHOP_ID || !config.YOOKASSA_SECRET_KEY) {
      if (!config.PAYMENT_MOCK_CHECKOUT_ENABLED) {
        throw new Error("YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY are required for paid RU checkout.");
      }

      return new MockSubscriptionPaymentProvider(this.code).createCheckout(input);
    }

    const idempotenceKey = randomUUID();
    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.YOOKASSA_SHOP_ID}:${config.YOOKASSA_SECRET_KEY}`).toString("base64")}`,
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify({
        amount: {
          value: formatMinorAmount(input.price.amountMinor),
          currency: input.price.currency,
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: config.YOOKASSA_RETURN_URL,
        },
        description: `nomduchat ${input.plan.name} subscription`,
        metadata: {
          userId: input.userId,
          planId: input.plan.id,
          country: input.price.country,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`YooKassa checkout failed with ${response.status}: ${body.slice(0, 500)}`);
    }

    const payment = (await response.json()) as YooKassaPaymentResponse;
    return {
      providerCheckoutId: payment.id,
      checkoutUrl: payment.confirmation?.confirmation_url ?? config.YOOKASSA_RETURN_URL,
    };
  }
}

export function createSubscriptionPaymentProvider(provider: PaymentProviderCode): SubscriptionPaymentProvider {
  if (provider === "kaspi") return new KaspiSubscriptionPaymentProvider();
  if (provider === "yookassa") return new YooKassaSubscriptionPaymentProvider();
  return new MockSubscriptionPaymentProvider(provider);
}

function formatMinorAmount(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}
