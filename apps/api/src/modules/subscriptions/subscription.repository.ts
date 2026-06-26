import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import { findPlan, findPlanPrice, subscriptionPlans } from "./plans.js";
import type {
  CheckoutStatus,
  CheckoutPaymentEvent,
  PaymentProviderCode,
  ProviderCheckoutEventInput,
  PlanId,
  PlanPrice,
  SubscriptionCheckoutRecord,
  SubscriptionCompletion,
  SubscriptionCountry,
  SubscriptionPlan,
  SubscriptionRecord,
  SubscriptionStatus,
} from "./subscription.types.js";

export interface SubscriptionRepository {
  listPlans(country: SubscriptionCountry): Promise<SubscriptionPlan[]>;
  findPlan(planId: PlanId): Promise<SubscriptionPlan | null>;
  createCheckout(input: {
    userId: string;
    plan: SubscriptionPlan;
    price: PlanPrice;
    providerCheckoutId: string;
    checkoutUrl: string;
  }): Promise<SubscriptionCheckoutRecord | null>;
  completeCheckoutPayment(
    checkoutId: string,
    event?: CheckoutPaymentEvent,
    expectedUserId?: string
  ): Promise<SubscriptionCompletion | null>;
  completeCheckoutPaymentByProvider(input: ProviderCheckoutEventInput): Promise<SubscriptionCompletion | null>;
  failCheckoutPaymentByProvider(input: ProviderCheckoutEventInput): Promise<SubscriptionCheckoutRecord | null>;
  markCheckoutCreditsGranted(checkoutId: string): Promise<SubscriptionCheckoutRecord | null>;
  currentSubscription(userId: string): Promise<SubscriptionRecord | null>;
  cancelCurrentSubscription(userId: string): Promise<SubscriptionRecord | null>;
}

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly checkouts = new Map<string, SubscriptionCheckoutRecord>();
  private readonly subscriptions = new Map<string, SubscriptionRecord>();

  async listPlans(country: SubscriptionCountry) {
    return subscriptionPlans.filter((plan) => plan.enabled && findPlanPrice(plan, country));
  }

  async findPlan(planId: PlanId) {
    return findPlan(planId);
  }

  async createCheckout(input: {
    userId: string;
    plan: SubscriptionPlan;
    price: PlanPrice;
    providerCheckoutId: string;
    checkoutUrl: string;
  }) {
    const now = new Date().toISOString();
    const checkout: SubscriptionCheckoutRecord = {
      id: randomUUID(),
      userId: input.userId,
      planId: input.plan.id,
      country: input.price.country,
      provider: input.price.provider,
      currency: input.price.currency,
      amountMinor: input.price.amountMinor,
      status: "pending",
      creditsGranted: false,
      providerCheckoutId: input.providerCheckoutId,
      checkoutUrl: input.checkoutUrl,
      createdAt: now,
      updatedAt: now,
    };

    this.checkouts.set(checkout.id, checkout);
    return checkout;
  }

  async completeCheckoutPayment(checkoutId: string, event?: CheckoutPaymentEvent, expectedUserId?: string) {
    const checkout = this.checkouts.get(checkoutId);
    if (!checkout) return null;
    if (expectedUserId && checkout.userId !== expectedUserId) return null;

    const existingSubscription = this.findCurrentSubscriptionRecord(checkout.userId);
    if (checkout.status === "completed" && existingSubscription) {
      return {
        checkout,
        subscription: existingSubscription,
        shouldGrantCredits: !checkout.creditsGranted,
      };
    }

    const now = new Date();
    const periodEnd = addMonth(now);
    const subscription: SubscriptionRecord = {
      id: randomUUID(),
      userId: checkout.userId,
      planId: checkout.planId,
      status: "active",
      country: checkout.country,
      provider: checkout.provider,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    checkout.status = "completed";
    checkout.updatedAt = now.toISOString();
    this.checkouts.set(checkout.id, checkout);
    this.subscriptions.set(subscription.id, subscription);

    return {
      checkout,
      subscription,
      shouldGrantCredits: true,
    };
  }

  async completeCheckoutPaymentByProvider(input: ProviderCheckoutEventInput) {
    const checkout = [...this.checkouts.values()].find(
      (candidate) =>
        candidate.provider === input.provider && candidate.providerCheckoutId === input.providerCheckoutId
    );

    return checkout ? this.completeCheckoutPayment(checkout.id, input) : null;
  }

  async failCheckoutPaymentByProvider(input: ProviderCheckoutEventInput) {
    const checkout = [...this.checkouts.values()].find(
      (candidate) =>
        candidate.provider === input.provider && candidate.providerCheckoutId === input.providerCheckoutId
    );
    if (!checkout) return null;

    checkout.status = input.eventType.includes("cancel") ? "cancelled" : "failed";
    checkout.updatedAt = new Date().toISOString();
    this.checkouts.set(checkout.id, checkout);
    return checkout;
  }

  async markCheckoutCreditsGranted(checkoutId: string) {
    const checkout = this.checkouts.get(checkoutId);
    if (!checkout) return null;

    checkout.creditsGranted = true;
    checkout.updatedAt = new Date().toISOString();
    this.checkouts.set(checkout.id, checkout);
    return checkout;
  }

  async currentSubscription(userId: string) {
    return this.findCurrentSubscriptionRecord(userId);
  }

  async cancelCurrentSubscription(userId: string) {
    const subscription = this.findCurrentSubscriptionRecord(userId);
    if (!subscription) return null;

    subscription.status = "cancelled";
    subscription.cancelAtPeriodEnd = true;
    subscription.updatedAt = new Date().toISOString();
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  private findCurrentSubscriptionRecord(userId: string) {
    return (
      [...this.subscriptions.values()]
        .filter((subscription) => subscription.userId === userId && subscription.status === "active")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
    );
  }
}

type PlanRow = {
  slug: string;
  name: string;
  monthly_credits: string | number;
  context_tokens: string | number;
  description: string;
  enabled: boolean;
  prices: PlanPrice[];
} & Record<string, unknown>;

type CheckoutRow = {
  id: string;
  user_id: string;
  plan_slug: PlanId;
  country_code: SubscriptionCountry;
  provider: PaymentProviderCode;
  currency: "KZT" | "RUB";
  amount_minor: string | number;
  status: CheckoutStatus;
  credits_granted: boolean;
  provider_checkout_id: string;
  checkout_url: string;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_slug: PlanId;
  status: SubscriptionStatus;
  country_code: SubscriptionCountry;
  provider: PaymentProviderCode;
  current_period_start: Date | string;
  current_period_end: Date | string;
  cancel_at_period_end: boolean;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  private seeded = false;

  constructor(private readonly database: DatabaseClient) {}

  async listPlans(country: SubscriptionCountry) {
    await this.ensureSeeded();
    const result = await this.database.query<PlanRow>(
      `
        select
          p.slug,
          p.name,
          p.monthly_credits,
          p.context_tokens,
          p.description,
          p.enabled,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'country', pp.country_code,
                'provider', pp.provider,
                'currency', pp.currency,
                'amountMinor', pp.amount_minor,
                'priceSource', pp.price_source
              )
            ) filter (where pp.id is not null),
            '[]'::jsonb
          ) as prices
        from plans p
        join plan_prices pp on pp.plan_id = p.id and pp.country_code = $1
        where p.enabled = true
        group by p.id
        order by p.sort_order asc
      `,
      [country]
    );

    return result.rows.map(mapPlanRow);
  }

  async findPlan(planId: PlanId) {
    await this.ensureSeeded();
    const result = await this.database.query<PlanRow>(
      `
        select
          p.slug,
          p.name,
          p.monthly_credits,
          p.context_tokens,
          p.description,
          p.enabled,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'country', pp.country_code,
                'provider', pp.provider,
                'currency', pp.currency,
                'amountMinor', pp.amount_minor,
                'priceSource', pp.price_source
              )
            ) filter (where pp.id is not null),
            '[]'::jsonb
          ) as prices
        from plans p
        left join plan_prices pp on pp.plan_id = p.id
        where p.slug = $1 and p.enabled = true
        group by p.id
        limit 1
      `,
      [planId]
    );

    const row = result.rows[0];
    return row ? mapPlanRow(row) : null;
  }

  async createCheckout(input: {
    userId: string;
    plan: SubscriptionPlan;
    price: PlanPrice;
    providerCheckoutId: string;
    checkoutUrl: string;
  }) {
    const databaseUserId = toDatabaseUserId(input.userId);
    if (!databaseUserId) return null;

    if (input.userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    const result = await this.database.query<CheckoutRow>(
      `
        insert into subscription_checkouts (
          user_id,
          plan_slug,
          country_code,
          provider,
          currency,
          amount_minor,
          provider_checkout_id,
          checkout_url
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning
          id,
          user_id,
          plan_slug,
          country_code,
          provider,
          currency,
          amount_minor,
          status,
          credits_granted,
          provider_checkout_id,
          checkout_url,
          created_at,
          updated_at
      `,
      [
        databaseUserId,
        input.plan.id,
        input.price.country,
        input.price.provider,
        input.price.currency,
        input.price.amountMinor,
        input.providerCheckoutId,
        input.checkoutUrl,
      ]
    );

    const row = result.rows[0];
    return row ? mapCheckoutRow(row) : null;
  }

  async completeCheckoutPayment(checkoutId: string, event?: CheckoutPaymentEvent, expectedUserId?: string) {
    if (!uuidPattern.test(checkoutId)) return null;
    const expectedDatabaseUserId = expectedUserId ? toDatabaseUserId(expectedUserId) : null;
    if (expectedUserId && !expectedDatabaseUserId) return null;

    return this.transaction(async (client) => {
      const checkout = await this.findCheckout(client, checkoutId, true);
      if (!checkout) return null;
      if (expectedDatabaseUserId && checkout.user_id !== expectedDatabaseUserId) return null;

      const existingSubscription = await this.findCurrentSubscription(client, checkout.user_id, true);
      if (checkout.status === "completed" && existingSubscription) {
        return {
          checkout: mapCheckoutRow(checkout),
          subscription: mapSubscriptionRow(existingSubscription),
          shouldGrantCredits: !checkout.credits_granted,
        };
      }

      const now = new Date();
      const periodEnd = addMonth(now);
      await client.query(
        `
          update subscriptions
          set status = 'cancelled',
              cancel_at_period_end = true,
              updated_at = now()
          where user_id = $1 and status = 'active'
        `,
        [checkout.user_id]
      );

      const subscriptionResult = await client.query<SubscriptionRow>(
        `
          insert into subscriptions (
            user_id,
            plan_slug,
            status,
            country_code,
            provider,
            current_period_start,
            current_period_end
          )
          values ($1, $2, 'active', $3, $4, $5, $6)
          returning
            id,
            user_id,
            plan_slug,
            status,
            country_code,
            provider,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            created_at,
            updated_at
        `,
        [checkout.user_id, checkout.plan_slug, checkout.country_code, checkout.provider, now.toISOString(), periodEnd.toISOString()]
      );

      const updatedCheckoutResult = await client.query<CheckoutRow>(
        `
          update subscription_checkouts
          set status = 'completed',
              updated_at = now()
          where id = $1
          returning
            id,
            user_id,
            plan_slug,
            country_code,
            provider,
            currency,
            amount_minor,
            status,
            credits_granted,
            provider_checkout_id,
            checkout_url,
            created_at,
            updated_at
        `,
        [checkoutId]
      );

      await client.query(
        `
          insert into subscription_events (subscription_id, checkout_id, event_type, provider, idempotency_key, payload)
          values ($1, $2, $3, $4, $5, $6::jsonb)
          on conflict (idempotency_key) do nothing
        `,
        [
          subscriptionResult.rows[0].id,
          checkoutId,
          event?.eventType ?? `${checkout.provider}.payment.completed`,
          checkout.provider,
          event?.idempotencyKey ?? `${checkout.provider}.payment.completed:${checkoutId}`,
          JSON.stringify(event?.payload ?? {
            checkoutId,
            planId: checkout.plan_slug,
            provider: checkout.provider,
          }),
        ]
      );

      return {
        checkout: mapCheckoutRow(updatedCheckoutResult.rows[0]),
        subscription: mapSubscriptionRow(subscriptionResult.rows[0]),
        shouldGrantCredits: true,
      };
    });
  }

  async completeCheckoutPaymentByProvider(input: ProviderCheckoutEventInput) {
    const result = await this.database.query<CheckoutRow>(
      `
        select
          id,
          user_id,
          plan_slug,
          country_code,
          provider,
          currency,
          amount_minor,
          status,
          credits_granted,
          provider_checkout_id,
          checkout_url,
          created_at,
          updated_at
        from subscription_checkouts
        where provider = $1 and provider_checkout_id = $2
        limit 1
      `,
      [input.provider, input.providerCheckoutId]
    );

    const checkout = result.rows[0];
    return checkout ? this.completeCheckoutPayment(checkout.id, input) : null;
  }

  async failCheckoutPaymentByProvider(input: ProviderCheckoutEventInput) {
    const result = await this.database.query<CheckoutRow>(
      `
        update subscription_checkouts
        set status = $3,
            updated_at = now()
        where provider = $1
          and provider_checkout_id = $2
          and status = 'pending'
        returning
          id,
          user_id,
          plan_slug,
          country_code,
          provider,
          currency,
          amount_minor,
          status,
          credits_granted,
          provider_checkout_id,
          checkout_url,
          created_at,
          updated_at
      `,
      [
        input.provider,
        input.providerCheckoutId,
        input.eventType.includes("cancel") ? "cancelled" : "failed",
      ]
    );

    let checkout = result.rows[0];
    if (!checkout) {
      const existing = await this.database.query<CheckoutRow>(
        `
          select
            id,
            user_id,
            plan_slug,
            country_code,
            provider,
            currency,
            amount_minor,
            status,
            credits_granted,
            provider_checkout_id,
            checkout_url,
            created_at,
            updated_at
          from subscription_checkouts
          where provider = $1 and provider_checkout_id = $2
          limit 1
        `,
        [input.provider, input.providerCheckoutId]
      );
      checkout = existing.rows[0];
      if (!checkout) return null;
    }

    await this.database.query(
      `
        insert into subscription_events (checkout_id, event_type, provider, idempotency_key, payload)
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (idempotency_key) do nothing
      `,
      [
        checkout.id,
        input.eventType,
        input.provider,
        input.idempotencyKey,
        JSON.stringify(input.payload),
      ]
    );

    return mapCheckoutRow(checkout);
  }

  async markCheckoutCreditsGranted(checkoutId: string) {
    if (!uuidPattern.test(checkoutId)) return null;

    const result = await this.database.query<CheckoutRow>(
      `
        update subscription_checkouts
        set credits_granted = true,
            updated_at = now()
        where id = $1
        returning
          id,
          user_id,
          plan_slug,
          country_code,
          provider,
          currency,
          amount_minor,
          status,
          credits_granted,
          provider_checkout_id,
          checkout_url,
          created_at,
          updated_at
      `,
      [checkoutId]
    );

    const row = result.rows[0];
    return row ? mapCheckoutRow(row) : null;
  }

  async currentSubscription(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const subscription = await this.findCurrentSubscription(this.database, databaseUserId);
    return subscription ? mapSubscriptionRow(subscription) : null;
  }

  async cancelCurrentSubscription(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<SubscriptionRow>(
      `
        update subscriptions
        set status = 'cancelled',
            cancel_at_period_end = true,
            updated_at = now()
        where id = (
          select id
          from subscriptions
          where user_id = $1 and status = 'active'
          order by created_at desc
          limit 1
        )
        returning
          id,
          user_id,
          plan_slug,
          status,
          country_code,
          provider,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          created_at,
          updated_at
      `,
      [databaseUserId]
    );

    const row = result.rows[0];
    return row ? mapSubscriptionRow(row) : null;
  }

  private async ensureSeeded() {
    if (this.seeded) return;

    for (const plan of subscriptionPlans) {
      await this.database.query(
        `
          insert into plans (slug, name, monthly_credits, context_tokens, description, enabled, sort_order)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (slug) do update set
            name = excluded.name,
            monthly_credits = excluded.monthly_credits,
            context_tokens = excluded.context_tokens,
            description = excluded.description,
            enabled = excluded.enabled,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [plan.id, plan.name, plan.monthlyCredits, plan.contextTokens, plan.description, plan.enabled, sortOrder(plan.id)]
      );

      for (const planPrice of plan.prices) {
        await this.database.query(
          `
            insert into plan_prices (plan_id, country_code, provider, currency, amount_minor, price_source)
            select id, $2, $3, $4, $5, $6
            from plans
            where slug = $1
            on conflict (plan_id, country_code) do update set
              provider = excluded.provider,
              currency = excluded.currency,
              amount_minor = case
                when plan_prices.price_source = 'admin_fixed_rate' then plan_prices.amount_minor
                else excluded.amount_minor
              end,
              price_source = case
                when plan_prices.price_source = 'admin_fixed_rate' then plan_prices.price_source
                else excluded.price_source
              end,
              updated_at = now()
          `,
          [
            plan.id,
            planPrice.country,
            planPrice.provider,
            planPrice.currency,
            planPrice.amountMinor,
            planPrice.priceSource,
          ]
        );
      }
    }

    this.seeded = true;
  }

  private async findCheckout(client: DatabaseClient, checkoutId: string, forUpdate = false) {
    const result = await client.query<CheckoutRow>(
      `
        select
          id,
          user_id,
          plan_slug,
          country_code,
          provider,
          currency,
          amount_minor,
          status,
          credits_granted,
          provider_checkout_id,
          checkout_url,
          created_at,
          updated_at
        from subscription_checkouts
        where id = $1
        limit 1
        ${forUpdate ? "for update" : ""}
      `,
      [checkoutId]
    );

    return result.rows[0] ?? null;
  }

  private async findCurrentSubscription(client: DatabaseClient, databaseUserId: string, forUpdate = false) {
    const result = await client.query<SubscriptionRow>(
      `
        select
          id,
          user_id,
          plan_slug,
          status,
          country_code,
          provider,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          created_at,
          updated_at
        from subscriptions
        where user_id = $1 and status = 'active'
        order by created_at desc
        limit 1
        ${forUpdate ? "for update" : ""}
      `,
      [databaseUserId]
    );

    return result.rows[0] ?? null;
  }

  private async transaction<T>(callback: (client: DatabaseClient) => Promise<T>) {
    if (!this.database.transaction) {
      throw new Error("Postgres subscription repository requires a transactional database client.");
    }

    return this.database.transaction(callback);
  }
}

function mapPlanRow(row: PlanRow): SubscriptionPlan {
  return {
    id: row.slug as PlanId,
    name: row.name,
    monthlyCredits: toNumber(row.monthly_credits),
    contextTokens: toNumber(row.context_tokens),
    description: row.description,
    enabled: row.enabled,
    prices: Array.isArray(row.prices) ? row.prices.map(mapPlanPrice) : [],
  };
}

function mapPlanPrice(value: PlanPrice): PlanPrice {
  return {
    country: value.country,
    provider: value.provider,
    currency: value.currency,
    amountMinor: toNumber(value.amountMinor),
    priceSource: value.priceSource,
  };
}

function mapCheckoutRow(row: CheckoutRow): SubscriptionCheckoutRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    planId: row.plan_slug,
    country: row.country_code,
    provider: row.provider,
    currency: row.currency,
    amountMinor: toNumber(row.amount_minor),
    status: row.status,
    creditsGranted: row.credits_granted,
    providerCheckoutId: row.provider_checkout_id,
    checkoutUrl: row.checkout_url,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapSubscriptionRow(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    planId: row.plan_slug,
    status: row.status,
    country: row.country_code,
    provider: row.provider,
    currentPeriodStart: new Date(row.current_period_start).toISOString(),
    currentPeriodEnd: new Date(row.current_period_end).toISOString(),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function addMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function sortOrder(planId: PlanId) {
  return planId === "base" ? 10 : planId === "ultra" ? 20 : planId === "pro" ? 30 : 40;
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}
