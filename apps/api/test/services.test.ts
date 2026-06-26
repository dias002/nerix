import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../src/config.js";
import type { DatabaseClient, DatabaseQueryResult } from "../src/database/index.js";
import { runDatabaseMigrations } from "../src/database/migrations.js";
import { estimateTextCredits, reserveCredits } from "../src/domain/credits.js";
import { InMemoryAgentRepository } from "../src/modules/agents/agent.repository.js";
import { AgentService } from "../src/modules/agents/agent.service.js";
import { AiGatewayService } from "../src/modules/ai-gateway/ai-gateway.service.js";
import {
  AnthropicCompletionProvider,
  type CompletionInput,
  type CompletionResult,
  type AiCompletionProvider,
  GeminiCompletionProvider,
  MockCompletionProvider,
  OpenAiCompletionProvider,
} from "../src/modules/ai-gateway/completion-provider.js";
import { inferModality } from "../src/modules/ai-gateway/modality-classifier.js";
import { chooseProvider } from "../src/modules/ai-gateway/provider-router.js";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.js";
import { signAccessToken, verifyAccessToken } from "../src/modules/auth/token.js";
import { BillingService } from "../src/modules/billing/billing.service.js";
import { InMemoryWalletRepository } from "../src/modules/billing/wallet.repository.js";
import { ChatService } from "../src/modules/chat/chat.service.js";
import { InMemoryConversationRepository } from "../src/modules/chat/conversation.repository.js";
import { GeminiMediaGenerationProvider } from "../src/modules/generation/media-provider.js";
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
  assert.equal(inferModality("сочини песню про войну"), "text");
  assert.equal(inferModality("напиши текст песни для рекламы"), "text");
  assert.equal(inferModality("сгенерируй трек для рекламы"), "music");
  assert.equal(inferModality("сгенерируй короткий музыкальный трек про кофе"), "music");
  assert.equal(inferModality("теперь сделай мне именно голосовым песню"), "music");
  assert.equal(inferModality("сгенерируй мне картинку по этому тексту"), "image");
  assert.equal(inferModality("озвучь этот текст голосом"), "voice");
  assert.equal(inferModality("сделай мне прям аудио"), "music");
  assert.equal(inferModality("Контекст диалога:\nсоздай видео про кофе\n\nПоследнее сообщение пользователя:\nсделай мне прям аудио"), "music");
  assert.equal(inferModality("найди bug в коде"), "code");
  assert.equal(inferModality("создай видео ролик"), "video");
  assert.equal(inferModality("сделай видео на 3 секунды про кофе"), "video");
  assert.equal(inferModality("обычный вопрос"), "text");
});

test("provider router separates supported and regional country routes", async () => {
  await withConfig({ AI_MOCK_PROVIDER_ENABLED: true }, () => {
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
      })?.provider,
      "mock-provider"
    );
  });

  await withConfig(
    {
      AI_MOCK_PROVIDER_ENABLED: false,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GOOGLE_AI_API_KEY: undefined,
    },
    () => {
      assert.equal(
        chooseProvider({
          country: "KZ",
          modality: "text",
          preferredModel: "text-primary",
        }),
        null
      );
    }
  );

  await withConfig(
    {
      AI_MOCK_PROVIDER_ENABLED: false,
      OPENAI_API_KEY: "openai-key",
      OPENAI_TEXT_MODEL: "openai-text",
      OPENAI_CODE_MODEL: "openai-code",
      ANTHROPIC_API_KEY: "anthropic-key",
      ANTHROPIC_TEXT_MODEL: "anthropic-text",
      ANTHROPIC_CODE_MODEL: "anthropic-code",
      GOOGLE_AI_API_KEY: "gemini-key",
      GEMINI_TEXT_MODEL: "gemini-text",
      GEMINI_IMAGE_MODEL: "gemini-image",
      GEMINI_VIDEO_MODEL: "gemini-video",
      GEMINI_MUSIC_MODEL: "gemini-music",
    },
    () => {
      assert.deepEqual(
        chooseProvider({
          country: "KZ",
          modality: "text",
          preferredModel: "text-primary",
        }),
        {
          provider: "openai",
          model: "openai-text",
          policyMode: "dev_allow_all",
          reason: "Dev policy: OpenAI is available for KZ.",
        }
      );

      assert.deepEqual(
        chooseProvider({
          country: "KZ",
          modality: "code",
          preferredModel: "code-primary",
          agentId: "code",
        }),
        {
          provider: "anthropic",
          model: "anthropic-code",
          policyMode: "dev_allow_all",
          reason: "Dev policy: Anthropic is available for KZ.",
        }
      );

      assert.deepEqual(
        chooseProvider({
          country: "KZ",
          modality: "text",
          preferredModel: "business-primary",
          agentId: "business",
        }),
        {
          provider: "anthropic",
          model: "anthropic-text",
          policyMode: "dev_allow_all",
          reason: "Dev policy: Anthropic is available for KZ.",
        }
      );

      assert.deepEqual(
        chooseProvider({
          country: "KZ",
          modality: "image",
          preferredModel: "image-primary",
          agentId: "image",
        }),
        {
          provider: "gemini",
          model: "gemini-image",
          policyMode: "dev_allow_all",
          reason: "Dev policy: Google Gemini is available for KZ.",
        }
      );

      assert.deepEqual(
        chooseProvider({
          country: "KZ",
          modality: "video",
          preferredModel: "video-primary",
          agentId: "video",
        }),
        {
          provider: "gemini",
          model: "gemini-video",
          policyMode: "dev_allow_all",
          reason: "Dev policy: Google Gemini is available for KZ.",
        }
      );

      assert.deepEqual(
        chooseProvider({
          country: "KZ",
          modality: "music",
          preferredModel: "music-primary",
          agentId: "music",
        }),
        {
          provider: "gemini",
          model: "gemini-music",
          policyMode: "dev_allow_all",
          reason: "Dev policy: Google Gemini is available for KZ.",
        }
      );

      assert.deepEqual(
        chooseProvider({
          country: "KZ",
          modality: "text",
          preferredModel: "music-primary",
          agentId: "music",
        }),
        {
          provider: "gemini",
          model: "gemini-text",
          policyMode: "dev_allow_all",
          reason: "Dev policy: Google Gemini is available for KZ.",
        }
      );
    }
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

test("generation service creates media jobs, stores artifacts, and can be started from chat", async () => {
  await withConfig({ AI_MOCK_PROVIDER_ENABLED: true, API_PUBLIC_URL: "http://127.0.0.1:4000" }, async () => {
    const dependencies = createDependencies();

    const blockedGenerationResponse = await dependencies.generation.createJob({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      modality: "music",
      prompt: "сделай песню для рекламы nomduchat",
    });

    assert.equal(blockedGenerationResponse.ok, false);
    if (blockedGenerationResponse.ok) return;
    assert.equal(blockedGenerationResponse.error.code, "subscription_required");

    const checkoutResponse = await dependencies.subscriptions.createCheckout({
      userId: "local-user",
      planId: "base",
      country: "KZ",
    });
    assert.equal(checkoutResponse.ok, true);
    if (!checkoutResponse.ok) return;

    const subscriptionResponse = await dependencies.subscriptions.completeMockCheckout({
      checkoutId: checkoutResponse.value.checkout.id,
      userId: "local-user",
    });
    assert.equal(subscriptionResponse.ok, true);

    const generationResponse = await dependencies.generation.createJob({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      modality: "music",
      prompt: "сделай песню для рекламы nomduchat",
    });

    assert.equal(generationResponse.ok, true);
    if (!generationResponse.ok) return;

    assert.equal(generationResponse.value.job.status, "succeeded");
    assert.equal(generationResponse.value.job.modality, "music");
    assert.equal(generationResponse.value.job.provider, "mock-provider");
    assert.match(generationResponse.value.job.resultUrl ?? "", /\/generation\/jobs\/.+\/artifact$/);
    assert.ok((generationResponse.value.job.finalCredits ?? 0) > 0);

    const artifactResponse = await dependencies.generation.getArtifact({
      userId: "local-user",
      jobId: generationResponse.value.job.id,
    });
    assert.equal(artifactResponse.ok, true);
    if (!artifactResponse.ok) return;
    assert.match(artifactResponse.value.data.toString("utf8"), /nomduchat mock music artifact/);

    const assetsResponse = await dependencies.generation.listAssets("local-user");
    assert.equal(assetsResponse.ok, true);
    if (!assetsResponse.ok) return;
    assert.equal(assetsResponse.value.assets.length, 1);
    assert.equal(assetsResponse.value.assets[0].mediaType, "music");

    const chatResponse = await dependencies.chat.sendMessage({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "создай видео ролик про продукт",
      agentId: "video",
    });
    assert.equal(chatResponse.ok, true);
    if (!chatResponse.ok) return;
    assert.equal(chatResponse.value.generationJob.modality, "video");
    assert.equal(chatResponse.value.generationJob.status, "succeeded");

    const seedTextResponse = await dependencies.chat.sendMessage({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "Вот текст песни: Казахстан просыпается под широким небом и держит путь вперед.",
    });
    assert.equal(seedTextResponse.ok, true);
    if (!seedTextResponse.ok) return;

    const contextualAudioResponse = await dependencies.chat.sendMessage({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      conversationId: seedTextResponse.value.conversationId,
      message: "сделай мне прям аудио",
    });
    assert.equal(contextualAudioResponse.ok, true);
    if (!contextualAudioResponse.ok) return;
    assert.equal(contextualAudioResponse.value.route.provider, "mock-provider");
    assert.equal(contextualAudioResponse.value.generationJob.modality, "music");
    assert.match(contextualAudioResponse.value.generationJob.prompt, /Казахстан просыпается под широким небом/);
    assert.match(contextualAudioResponse.value.generationJob.prompt, /Последняя просьба пользователя/);

    const generalStartResponse = await dependencies.chat.sendMessage({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "привет, что ты умеешь?",
    });
    assert.equal(generalStartResponse.ok, true);
    if (!generalStartResponse.ok) return;
    assert.equal(generalStartResponse.value.route.agentId, "general");

    const songInsideGeneralConversation = await dependencies.chat.sendMessage({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      conversationId: generalStartResponse.value.conversationId,
      message: "сочини песню про дом у моря",
    });
    assert.equal(songInsideGeneralConversation.ok, true);
    if (!songInsideGeneralConversation.ok) return;
    assert.equal(songInsideGeneralConversation.value.route.agentId, "general");
    assert.equal(songInsideGeneralConversation.value.route.modality, "text");

    const audioInsideGeneralConversation = await dependencies.chat.sendMessage({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      conversationId: generalStartResponse.value.conversationId,
      message: "сделай мне прям аудио",
    });
    assert.equal(audioInsideGeneralConversation.ok, true);
    if (!audioInsideGeneralConversation.ok) return;
    assert.equal(audioInsideGeneralConversation.value.route.agentId, "general");
    assert.equal(audioInsideGeneralConversation.value.generationJob.modality, "music");
    assert.match(audioInsideGeneralConversation.value.generationJob.prompt, /сочини песню про дом у моря/);

    const contextualImageResponse = await dependencies.chat.sendMessage({
      userId: "local-user",
      country: "KZ",
      language: "ru",
      conversationId: seedTextResponse.value.conversationId,
      message: "сгенерируй картинку по этому тексту",
    });
    assert.equal(contextualImageResponse.ok, true);
    if (!contextualImageResponse.ok) return;
    assert.equal(contextualImageResponse.value.generationJob.modality, "image");
    assert.match(contextualImageResponse.value.generationJob.prompt, /Контекст диалога/);
    assert.match(contextualImageResponse.value.generationJob.prompt, /Казахстан просыпается под широким небом/);
    assert.match(contextualImageResponse.value.generationJob.prompt, /Последняя просьба пользователя/);
  });
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
  assert.match(sql, /alter table generation_jobs[\s\S]*reservation_id/);
  assert.match(sql, /alter table generation_jobs[\s\S]*result_url/);
  assert.match(sql, /alter table generation_jobs[\s\S]*metadata/);
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

test("AI completion providers use backend company keys for OpenAI, Anthropic, and Gemini", async () => {
  await withConfig({ AI_MOCK_PROVIDER_ENABLED: true }, async () => {
    const mock = await new MockCompletionProvider().complete({
      provider: "mock-provider",
      model: "mock-text",
      prompt: "hello",
    });
    assert.match(mock.content, /mock-ответ nomduchat/);
  });

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

  await withConfig({ ANTHROPIC_API_KEY: "anthropic-key" }, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetchStub(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({
        content: [{ type: "text", text: "Anthropic adapter response" }],
        usage: {
          input_tokens: 5,
          output_tokens: 4,
        },
      });
    }, async () => {
      const result = await new AnthropicCompletionProvider().complete({
        provider: "anthropic",
        model: "claude-test",
        prompt: "Скажи коротко",
        systemPrompt: "Ты ассистент nomduchat.",
      });

      assert.equal(result.content, "Anthropic adapter response");
      assert.deepEqual(result.rawUsage, {
        input_tokens: 5,
        output_tokens: 4,
      });
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
    assert.equal(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["x-api-key"], "anthropic-key");
    assert.equal(headers["anthropic-version"], "2023-06-01");

    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.model, "claude-test");
    assert.equal(body.system, "Ты ассистент nomduchat.");
    assert.deepEqual(body.messages, [{ role: "user", content: "Скажи коротко" }]);
  });

  await withConfig({ GOOGLE_AI_API_KEY: "gemini-key" }, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetchStub(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Gemini adapter response" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 6,
          candidatesTokenCount: 3,
        },
      });
    }, async () => {
      const result = await new GeminiCompletionProvider().complete({
        provider: "gemini",
        model: "gemini-test",
        prompt: "Скажи коротко",
        systemPrompt: "Ты ассистент nomduchat.",
      });

      assert.equal(result.content, "Gemini adapter response");
      assert.deepEqual(result.rawUsage, {
        promptTokenCount: 6,
        candidatesTokenCount: 3,
      });
    });

    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.origin, "https://generativelanguage.googleapis.com");
    assert.equal(url.pathname, "/v1beta/models/gemini-test:generateContent");
    assert.equal(url.searchParams.get("key"), "gemini-key");
    assert.equal(calls[0].init?.method, "POST");

    const body = JSON.parse(String(calls[0].init?.body));
    assert.deepEqual(body.systemInstruction, {
      parts: [{ text: "Ты ассистент nomduchat." }],
    });
    assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "Скажи коротко" }] }]);
  });
});

test("Gemini media provider sends interaction payloads without unsupported config", async () => {
  await withConfig({ GOOGLE_AI_API_KEY: "gemini-key" }, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetchStub(async (input, init) => {
      calls.push({ url: String(input), init });
      const body = JSON.parse(String(init?.body));
      const mimeType = typeof body.input === "string" ? "audio/mpeg" : "image/png";

      return jsonResponse({
        output: [
          {
            mime_type: mimeType,
            data: Buffer.from(`mock ${mimeType}`, "utf8").toString("base64"),
          },
        ],
      });
    }, async () => {
      const imageResult = await new GeminiMediaGenerationProvider().generate({
        jobId: "job-image",
        provider: "gemini",
        model: "models/gemini-image-test",
        modality: "image",
        prompt: "сгенерируй картинку по тексту",
      });

      assert.equal(imageResult.status, "succeeded");
      assert.equal(imageResult.mimeType, "image/png");

      const musicResult = await new GeminiMediaGenerationProvider().generate({
        jobId: "job-music",
        provider: "gemini",
        model: "lyria-test",
        modality: "music",
        prompt: "сделай голосовую песню",
      });

      assert.equal(musicResult.status, "succeeded");
      assert.equal(musicResult.mimeType, "audio/mpeg");
    });

    assert.equal(calls.length, 2);
    for (const call of calls) {
      const url = new URL(call.url);
      assert.equal(url.origin, "https://generativelanguage.googleapis.com");
      assert.equal(url.pathname, "/v1beta/interactions");
      assert.equal(url.searchParams.get("key"), "gemini-key");
      assert.equal(call.init?.method, "POST");
      const body = JSON.parse(String(call.init?.body));
      assert.equal(body.config, undefined);
    }

    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      model: "gemini-image-test",
      input: [{ type: "text", text: "сгенерируй картинку по тексту" }],
    });
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      model: "lyria-test",
      input: "сделай голосовую песню",
    });
  });
});

test("Gemini media provider starts video without unsupported numberOfVideos parameter", async () => {
  await withConfig({ GOOGLE_AI_API_KEY: "gemini-key" }, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetchStub(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({
        name: "operations/video-test",
      });
    }, async () => {
      const videoResult = await new GeminiMediaGenerationProvider().generate({
        jobId: "job-video",
        provider: "gemini",
        model: "veo-test",
        modality: "video",
        prompt: "создай короткое видео",
      });

      assert.equal(videoResult.status, "running");
      assert.equal(videoResult.operationName, "operations/video-test");
    });

    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.origin, "https://generativelanguage.googleapis.com");
    assert.equal(url.pathname, "/v1beta/models/veo-test:predictLongRunning");
    assert.equal(url.searchParams.get("key"), "gemini-key");
    assert.equal(calls[0].init?.method, "POST");

    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.parameters.numberOfVideos, undefined);
    assert.deepEqual(body, {
      instances: [
        {
          prompt: "создай короткое видео",
        },
      ],
      parameters: {
        resolution: "720p",
      },
    });
  });
});

test("Gemini media provider extracts video URI from completed Veo operation", async () => {
  await withConfig({ GOOGLE_AI_API_KEY: "gemini-key" }, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetchStub(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({
        name: "models/veo-test/operations/video-test",
        done: true,
        response: {
          "@type": "type.googleapis.com/google.ai.generativelanguage.v1beta.PredictLongRunningResponse",
          generateVideoResponse: {
            generatedSamples: [
              {
                video: {
                  uri: "https://generativelanguage.googleapis.com/v1beta/files/mock-video:download?alt=media",
                },
              },
            ],
          },
        },
      });
    }, async () => {
      const result = await new GeminiMediaGenerationProvider().refresh("models/veo-test/operations/video-test");

      assert.equal(result.status, "succeeded");
      assert.equal(result.mimeType, "video/mp4");
      assert.equal(
        result.providerUri,
        "https://generativelanguage.googleapis.com/v1beta/files/mock-video:download?alt=media"
      );
    });

    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/v1beta/models/veo-test/operations/video-test");
    assert.equal(url.searchParams.get("key"), "gemini-key");
  });
});

test("Gemini media provider cancels long running operations", async () => {
  await withConfig({ GOOGLE_AI_API_KEY: "gemini-key" }, async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    await withFetchStub(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({});
    }, async () => {
      const result = await new GeminiMediaGenerationProvider().cancel("models/veo-test/operations/video-test");
      assert.deepEqual(result.raw, {});
    });

    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(url.origin, "https://generativelanguage.googleapis.com");
    assert.equal(url.pathname, "/v1beta/models/veo-test/operations/video-test:cancel");
    assert.equal(url.searchParams.get("key"), "gemini-key");
    assert.equal(calls[0].init?.method, "POST");
  });
});

test("chat completions include previous messages for follow-up context", async () => {
  await withConfig(
    {
      AI_MOCK_PROVIDER_ENABLED: true,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GOOGLE_AI_API_KEY: undefined,
    },
    async () => {
      const agents = new AgentService(new InMemoryAgentRepository());
      const billing = new BillingService(new InMemoryWalletRepository(), agents);
      const completionProvider = new CapturingCompletionProvider();
      const aiGateway = new AiGatewayService(agents, billing, completionProvider);
      const chat = new ChatService(new InMemoryConversationRepository(), aiGateway);

      const firstResponse = await chat.sendMessage({
        userId: "local-user",
        country: "KZ",
        language: "ru",
        message: "Меня зовут Диас, помоги написать теплый текст про маму.",
      });
      assert.equal(firstResponse.ok, true);
      if (!firstResponse.ok) return;

      const followUpResponse = await chat.sendMessage({
        userId: "local-user",
        country: "KZ",
        language: "ru",
        conversationId: firstResponse.value.conversationId,
        message: "каких деталей тебе не хватает?",
      });
      assert.equal(followUpResponse.ok, true);

      const followUpPrompt = completionProvider.inputs.at(-1)?.prompt ?? "";
      assert.match(followUpPrompt, /Контекст диалога/);
      assert.match(followUpPrompt, /Меня зовут Диас, помоги написать теплый текст про маму/);
      assert.match(followUpPrompt, /Последнее сообщение пользователя:\nкаких деталей тебе не хватает/);
    }
  );
});

test("chat follow-ups inherit the conversation agent and keep creative context", async () => {
  await withConfig(
    {
      AI_MOCK_PROVIDER_ENABLED: true,
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      GOOGLE_AI_API_KEY: undefined,
    },
    async () => {
      const agents = new AgentService(new InMemoryAgentRepository());
      const billing = new BillingService(new InMemoryWalletRepository(), agents);
      const completionProvider = new CapturingCompletionProvider();
      const aiGateway = new AiGatewayService(agents, billing, completionProvider);
      const activeSubscriptions = {
        async currentSubscription() {
          return {
            ok: true as const,
            value: {
              subscription: {
                planId: "base",
                status: "active",
              },
            },
          };
        },
      };
      const chat = new ChatService(new InMemoryConversationRepository(), aiGateway, undefined, activeSubscriptions);

      const firstResponse = await chat.sendMessage({
        userId: "local-user",
        country: "KZ",
        language: "ru",
        message: "сочини песню про войну",
      });
      assert.equal(firstResponse.ok, true);
      if (!firstResponse.ok) return;
      assert.equal(firstResponse.value.route.agentId, "music");
      assert.equal(firstResponse.value.route.modality, "text");

      const followUpResponse = await chat.sendMessage({
        userId: "local-user",
        country: "KZ",
        language: "ru",
        conversationId: firstResponse.value.conversationId,
        message: "какие детали?",
      });
      assert.equal(followUpResponse.ok, true);
      if (!followUpResponse.ok) return;
      assert.equal(followUpResponse.value.route.agentId, "music");
      assert.equal(followUpResponse.value.route.modality, "text");

      const followUpPrompt = completionProvider.inputs.at(-1)?.prompt ?? "";
      assert.match(followUpPrompt, /сочини песню про войну/);
      assert.match(followUpPrompt, /какие детали/);
      assert.match(followUpPrompt, /относительно последней просьбы/);
    }
  );
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

test("mailing service rejects SMTP header injection fields", async () => {
  const mailings = new MailingService(new InMemoryMailingRepository(), new FakeMailingTransport());
  const audienceResponse = await mailings.createAudience({
    userId: "local-user",
    name: "Security test",
  });
  assert.equal(audienceResponse.ok, true);
  if (!audienceResponse.ok) return;

  const response = await mailings.createCampaign({
    userId: "local-user",
    audienceId: audienceResponse.value.audience.id,
    name: "Injected",
    fromEmail: "info@example.com",
    fromName: "Nomduchat",
    subject: "Hello\r\nBcc: attacker@example.com",
    html: "<p>Hello</p>",
  });

  assert.equal(response.ok, false);
  if (response.ok) return;
  assert.equal(response.error.code, "validation_failed");
});

class CapturingCompletionProvider implements AiCompletionProvider {
  readonly inputs: CompletionInput[] = [];

  async complete(input: CompletionInput): Promise<CompletionResult> {
    this.inputs.push(input);
    return {
      content: "captured",
    };
  }
}

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
