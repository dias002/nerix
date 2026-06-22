import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../src/config.js";
import type { DatabaseClient, DatabaseQueryResult } from "../src/database/index.js";
import { runDatabaseMigrations } from "../src/database/migrations.js";
import { estimateTextCredits, reserveCredits } from "../src/domain/credits.js";
import {
  MockCompletionProvider,
  OpenAiCompletionProvider,
} from "../src/modules/ai-gateway/completion-provider.js";
import { inferModality } from "../src/modules/ai-gateway/modality-classifier.js";
import { chooseProvider } from "../src/modules/ai-gateway/provider-router.js";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.js";
import { signAccessToken, verifyAccessToken } from "../src/modules/auth/token.js";
import { InMemoryMailingRepository } from "../src/modules/mailings/mailing.repository.js";
import { MailingService, parseContacts } from "../src/modules/mailings/mailing.service.js";
import type { SmtpBzMessage } from "../src/modules/mailings/mailing.types.js";
import type { MailingTransport, SendMassEmailInput } from "../src/modules/mailings/smtp-bz.client.js";
import { findPlanPrice, subscriptionPlans } from "../src/modules/subscriptions/plans.js";
import {
  KaspiSubscriptionPaymentProvider,
  YooKassaSubscriptionPaymentProvider,
} from "../src/modules/subscriptions/payment-provider.js";
import { createDependencies } from "../src/server/dependencies.js";

test("credits estimator has a minimum and applies multiplier", () => {
  assert.equal(estimateTextCredits("hi"), 30);
  assert.equal(estimateTextCredits("a".repeat(400), 1.4), 70);
  assert.equal(reserveCredits(100), 125);
});

test("modality classifier detects media and code tasks", () => {
  assert.equal(inferModality("сделай песню для рекламы"), "music");
  assert.equal(inferModality("найди bug в коде"), "code");
  assert.equal(inferModality("создай видео ролик"), "video");
  assert.equal(inferModality("обычный вопрос"), "text");
});

test("provider router separates supported and regional country routes", () => {
  assert.deepEqual(
    chooseProvider({
      country: "KZ",
      modality: "text",
      preferredModel: "text-primary",
    }),
    {
      provider: "mock-provider",
      model: "mock-text",
      policyMode: "dev_allow_all",
      reason: "Dev policy: Local Mock Provider is available for KZ.",
    }
  );

  assert.equal(
    chooseProvider({
      country: "RU",
      modality: "music",
      preferredModel: "music-primary",
    }).provider,
    "mock-provider"
  );
});

test("billing service reserves, captures, and refunds credits", async () => {
  const dependencies = createDependencies();
  const walletBefore = await dependencies.billing.getWallet("local-user");
  assert.equal(walletBefore.ok, true);
  if (!walletBefore.ok) return;

  const reservation = await dependencies.billing.reserve({
    userId: "local-user",
    prompt: "Напиши архитектуру API для nomduchat",
    agentId: "general",
    referenceId: "test-request",
  });

  assert.equal(reservation.ok, true);
  if (!reservation.ok) return;

  assert.ok(reservation.value.reservationId);
  assert.equal(
    reservation.value.wallet.availableCredits,
    walletBefore.value.availableCredits - reservation.value.estimate.reserveCredits
  );
  assert.equal(reservation.value.wallet.reservedCredits, reservation.value.estimate.reserveCredits);

  const captured = await dependencies.billing.capture({
    userId: "local-user",
    reservationId: reservation.value.reservationId,
    finalCredits: reservation.value.estimate.estimatedCredits,
  });

  assert.equal(captured.ok, true);
  if (!captured.ok) return;

  const unusedCredits = reservation.value.estimate.reserveCredits - reservation.value.estimate.estimatedCredits;
  const refunded = await dependencies.billing.refund({
    userId: "local-user",
    reservationId: reservation.value.reservationId,
    credits: unusedCredits,
  });

  assert.equal(refunded.ok, true);
  if (!refunded.ok) return;

  assert.equal(refunded.value.reservedCredits, 0);
  assert.equal(
    refunded.value.availableCredits,
    walletBefore.value.availableCredits - reservation.value.estimate.estimatedCredits
  );
});

test("database migrations include runtime columns for auth and subscriptions", async () => {
  const queries: string[] = [];
  const database: DatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string
    ): Promise<DatabaseQueryResult<T>> {
      queries.push(text);
      return { rows: [], rowCount: 0 };
    },
    async health() {
      return { ok: true, configured: true };
    },
    async close() {
      return undefined;
    },
  };

  await runDatabaseMigrations(database);

  const sql = queries.join("\n").toLowerCase();
  assert.match(sql, /create extension if not exists "uuid-ossp"/);
  assert.match(sql, /create extension if not exists pg_trgm/);
  assert.match(sql, /create table if not exists users/);
  assert.match(sql, /create table if not exists wallets/);
  assert.match(sql, /create table if not exists ledger_entries/);
  assert.match(sql, /alter table users[\s\S]*password_hash/);
  assert.match(sql, /alter table users[\s\S]*system_role/);
  assert.match(sql, /create table if not exists ai_providers/);
  assert.match(sql, /create table if not exists agents/);
  assert.match(sql, /create table if not exists plans/);
  assert.match(sql, /create table if not exists subscription_checkouts/);
  assert.match(sql, /provider_checkout_id/);
  assert.match(sql, /create table if not exists subscriptions/);
  assert.match(sql, /create table if not exists oauth_accounts/);
  assert.match(sql, /create table if not exists business_groups/);
  assert.match(sql, /create table if not exists business_employee_activity/);
  assert.match(sql, /create table if not exists business_employee_daily_reports/);
  assert.match(sql, /last_activity_at/);
  assert.match(sql, /create table if not exists business_client_reports/);
  assert.match(sql, /create table if not exists conversations/);
  assert.match(sql, /create table if not exists messages/);
  assert.match(sql, /create index if not exists conversations_user_updated_idx/);
  assert.match(sql, /create index if not exists messages_conversation_created_idx/);
  assert.match(sql, /create table if not exists files/);
  assert.match(sql, /create index if not exists files_user_created_idx/);
  assert.match(sql, /create table if not exists user_projects/);
  assert.match(sql, /create table if not exists user_media_assets/);
  assert.match(sql, /create table if not exists custom_ai_bots/);
  assert.match(sql, /create table if not exists bot_knowledge_sources/);
  assert.match(sql, /create table if not exists message_answer_variants/);
  assert.match(sql, /create table if not exists message_feedback/);
  assert.match(sql, /create table if not exists ai_error_events/);
  assert.match(sql, /create table if not exists ai_improvement_tasks/);
  assert.match(sql, /create table if not exists memory_items/);
  assert.match(sql, /create table if not exists usage_events/);
  assert.match(sql, /create index if not exists usage_events_user_created_idx/);
  assert.match(sql, /create table if not exists generation_jobs/);
  assert.match(sql, /create table if not exists audit_logs/);
  assert.match(sql, /create index if not exists subscription_checkouts_provider_checkout_idx/);
});

test("auth password hashes and access tokens reject invalid credentials", async () => {
  const encoded = hashPassword("secure-password");

  assert.notEqual(encoded, "secure-password");
  assert.match(encoded, /^pbkdf2_sha256\$/);
  assert.equal(verifyPassword("secure-password", encoded), true);
  assert.equal(verifyPassword("wrong-password", encoded), false);
  assert.equal(verifyPassword("secure-password", "plain-text"), false);

  await withConfig({ ACCESS_TOKEN_TTL_SECONDS: 60 }, () => {
    const token = signAccessToken({
      userId: "user-1",
      email: "user@example.com",
    });
    const payload = verifyAccessToken(token);

    assert.equal(payload?.sub, "user-1");
    assert.equal(payload?.email, "user@example.com");

    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(verifyAccessToken(tamperedToken), null);
  });

  await withConfig({ ACCESS_TOKEN_TTL_SECONDS: -1 }, () => {
    const expiredToken = signAccessToken({
      userId: "user-1",
      email: "user@example.com",
    });

    assert.equal(verifyAccessToken(expiredToken), null);
  });
});

test("AI completion providers use mock fallback and OpenAI Responses request shape", async () => {
  const mock = await new MockCompletionProvider().complete({
    provider: "mock-provider",
    model: "mock-text",
    prompt: "hello",
  });
  assert.match(mock.content, /mock-ответ nomduchat/);

  await withConfig({ OPENAI_API_KEY: "sk-test" }, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetchStub(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({
        output_text: "OpenAI adapter response",
        usage: {
          input_tokens: 7,
          output_tokens: 3,
        },
      });
    }, async () => {
      const result = await new OpenAiCompletionProvider().complete({
        provider: "openai",
        model: "gpt-5.2",
        prompt: "Скажи коротко",
        systemPrompt: "Ты ассистент nomduchat.",
      });

      assert.equal(result.content, "OpenAI adapter response");
      assert.deepEqual(result.rawUsage, {
        input_tokens: 7,
        output_tokens: 3,
      });
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.openai.com/v1/responses");
    assert.equal(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer sk-test");

    const body = JSON.parse(String(calls[0].init?.body));
    assert.deepEqual(body, {
      model: "gpt-5.2",
      instructions: "Ты ассистент nomduchat.",
      input: "Скажи коротко",
    });
  });
});

test("subscription payment providers build Kaspi links and YooKassa payment requests", async () => {
  const basePlan = subscriptionPlans[0];
  const kzPrice = findPlanPrice(basePlan, "KZ");
  const ruPrice = findPlanPrice(basePlan, "RU");
  assert.ok(kzPrice);
  assert.ok(ruPrice);

  await withConfig({ KASPI_CHECKOUT_URL: undefined }, async () => {
    const checkout = await new KaspiSubscriptionPaymentProvider().createCheckout({
      userId: "user-1",
      plan: basePlan,
      price: kzPrice,
    });

    assert.match(checkout.providerCheckoutId, /^mock_/);
    assert.equal(checkout.checkoutUrl, "nomduchat://mock-checkout/kaspi/base");
  });

  await withConfig({ KASPI_CHECKOUT_URL: undefined, PAYMENT_MOCK_CHECKOUT_ENABLED: false }, async () => {
    await assert.rejects(
      new KaspiSubscriptionPaymentProvider().createCheckout({
        userId: "user-1",
        plan: basePlan,
        price: kzPrice,
      }),
      /KASPI_CHECKOUT_URL/
    );
  });

  await withConfig({ KASPI_CHECKOUT_URL: "https://pay.example.test/checkout" }, async () => {
    const checkout = await new KaspiSubscriptionPaymentProvider().createCheckout({
      userId: "user-1",
      plan: basePlan,
      price: kzPrice,
    });
    const checkoutUrl = new URL(checkout.checkoutUrl);

    assert.match(checkout.providerCheckoutId, /^kaspi_/);
    assert.equal(checkoutUrl.origin, "https://pay.example.test");
    assert.equal(checkoutUrl.searchParams.get("providerCheckoutId"), checkout.providerCheckoutId);
    assert.equal(checkoutUrl.searchParams.get("planId"), "base");
    assert.equal(checkoutUrl.searchParams.get("userId"), "user-1");
    assert.equal(checkoutUrl.searchParams.get("amountMinor"), String(kzPrice.amountMinor));
    assert.equal(checkoutUrl.searchParams.get("currency"), "KZT");
  });

  await withConfig(
    {
      YOOKASSA_SHOP_ID: "shop-id",
      YOOKASSA_SECRET_KEY: "secret-key",
      YOOKASSA_RETURN_URL: "https://nomduchat.example.test/balance",
    },
    async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];

      await withFetchStub(async (input, init) => {
        calls.push({ url: String(input), init });
        return jsonResponse({
          id: "payment-123",
          confirmation: {
            confirmation_url: "https://yookassa.example.test/confirm/payment-123",
          },
        });
      }, async () => {
        const checkout = await new YooKassaSubscriptionPaymentProvider().createCheckout({
          userId: "user-1",
          plan: basePlan,
          price: ruPrice,
        });

        assert.equal(checkout.providerCheckoutId, "payment-123");
        assert.equal(checkout.checkoutUrl, "https://yookassa.example.test/confirm/payment-123");
      });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.yookassa.ru/v3/payments");
      assert.equal(calls[0].init?.method, "POST");
      const headers = calls[0].init?.headers as Record<string, string>;
      assert.equal(headers.Authorization, `Basic ${Buffer.from("shop-id:secret-key").toString("base64")}`);
      assert.ok(headers["Idempotence-Key"]);

      const body = JSON.parse(String(calls[0].init?.body));
      assert.deepEqual(body.amount, {
        value: "990.00",
        currency: "RUB",
      });
      assert.equal(body.capture, true);
      assert.deepEqual(body.confirmation, {
        type: "redirect",
        return_url: "https://nomduchat.example.test/balance",
      });
      assert.deepEqual(body.metadata, {
        userId: "user-1",
        planId: "base",
        country: "RU",
      });
    }
  );

  await withConfig(
    {
      YOOKASSA_SHOP_ID: undefined,
      YOOKASSA_SECRET_KEY: undefined,
      PAYMENT_MOCK_CHECKOUT_ENABLED: false,
    },
    async () => {
      await assert.rejects(
        new YooKassaSubscriptionPaymentProvider().createCheckout({
          userId: "user-1",
          plan: basePlan,
          price: ruPrice,
        }),
        /YOOKASSA_SHOP_ID/
      );
    }
  );
});

test("mailing service imports contacts, sends campaign, and syncs SMTP.BZ events", async () => {
  const transport = new FakeMailingTransport();
  const mailings = new MailingService(new InMemoryMailingRepository(), transport);

  const audienceResponse = await mailings.createAudience({
    userId: "local-user",
    name: "Учебный центр",
  });
  assert.equal(audienceResponse.ok, true);
  if (!audienceResponse.ok) return;

  const importResponse = await mailings.importContacts({
    userId: "local-user",
    audienceId: audienceResponse.value.audience.id,
    rawContacts: [
      "Student One, student@example.com",
      "Old Client, old@example.com",
      "student@example.com",
      "invalid-line",
    ].join("\n"),
  });
  assert.equal(importResponse.ok, true);
  if (!importResponse.ok) return;
  assert.equal(importResponse.value.summary.imported, 2);
  assert.equal(importResponse.value.summary.updated, 0);
  assert.equal(importResponse.value.summary.totalActiveContacts, 2);

  const campaignResponse = await mailings.createCampaign({
    userId: "local-user",
    audienceId: audienceResponse.value.audience.id,
    name: "June course",
    fromEmail: "info@example.com",
    fromName: "Study Center",
    subject: "Course update",
    html: "<p>Hello</p>",
  });
  assert.equal(campaignResponse.ok, true);
  if (!campaignResponse.ok) return;

  const sendResponse = await mailings.sendCampaign({
    userId: "local-user",
    campaignId: campaignResponse.value.campaign.id,
  });
  assert.equal(sendResponse.ok, true);
  if (!sendResponse.ok) return;
  assert.equal(sendResponse.value.accepted, 2);
  assert.equal(transport.lastSend?.contacts.length, 2);

  const repeatedSendResponse = await mailings.sendCampaign({
    userId: "local-user",
    campaignId: campaignResponse.value.campaign.id,
  });
  assert.equal(repeatedSendResponse.ok, false);
  if (repeatedSendResponse.ok) return;
  assert.equal(repeatedSendResponse.error.code, "validation_failed");

  transport.messages = [
    {
      to: "student@example.com",
      status: "sent",
      isOpen: true,
      raw: {},
    },
    {
      to: "old@example.com",
      status: "sent",
      isUnsubscribe: true,
      raw: {},
    },
  ];

  const syncResponse = await mailings.syncCampaign({
    userId: "local-user",
    campaignId: campaignResponse.value.campaign.id,
  });
  assert.equal(syncResponse.ok, true);
  if (!syncResponse.ok) return;
  assert.equal(syncResponse.value.opened, 1);
  assert.equal(syncResponse.value.unsubscribed, 1);

  const recipientsResponse = await mailings.listRecipients({
    userId: "local-user",
    campaignId: campaignResponse.value.campaign.id,
  });
  assert.equal(recipientsResponse.ok, true);
  if (!recipientsResponse.ok) return;
  assert.deepEqual(
    recipientsResponse.value.recipients.map((recipient) => [recipient.email, recipient.status]).sort(),
    [
      ["old@example.com", "unsubscribed"],
      ["student@example.com", "opened"],
    ]
  );
});

test("mailing contact parser extracts email and optional names from pasted rows", () => {
  assert.deepEqual(parseContacts("Ivan Petrov, ivan@example.com\nplain@example.com"), [
    {
      email: "ivan@example.com",
      name: "Ivan Petrov",
    },
    {
      email: "plain@example.com",
      name: undefined,
    },
  ]);
});

class FakeMailingTransport implements MailingTransport {
  messages: SmtpBzMessage[] = [];
  lastSend: SendMassEmailInput | null = null;

  async sendMass(input: SendMassEmailInput) {
    this.lastSend = input;
    return {
      accepted: input.contacts.length,
      raw: {
        ok: true,
      },
    };
  }

  async fetchMessagesByTag() {
    return this.messages;
  }
}

async function withConfig<T>(patch: Partial<typeof config>, callback: () => T | Promise<T>) {
  const mutableConfig = config as unknown as Record<string, unknown>;
  const previous = new Map<string, unknown>();

  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, mutableConfig[key]);
    mutableConfig[key] = value;
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      mutableConfig[key] = value;
    }
  }
}

async function withFetchStub<T>(fetchStub: typeof fetch, callback: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
