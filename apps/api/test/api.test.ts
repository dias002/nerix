import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../src/config.js";
import type { DatabaseClient, DatabaseQueryResult } from "../src/database/index.js";
import { createApp } from "../src/server/create-app.js";
import { createDependencies } from "../src/server/dependencies.js";

test("GET /health returns service status", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    service: "nomduchat-api",
    version: "0.1.0",
  });

  await app.close();
});

test("GET /health/database reports missing database in test app", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/health/database",
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().configured, false);

  await app.close();
});

test("GET /health/database reports injected database status", async () => {
  const database: DatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<DatabaseQueryResult<T>> {
      return { rows: [], rowCount: 0 };
    },
    async health() {
      return { ok: true, configured: true, latencyMs: 1 };
    },
    async close() {
      return undefined;
    },
  };
  const app = await createApp({
    dependencies: createDependencies({ database }),
  });

  const response = await app.inject({
    method: "GET",
    url: "/health/database",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().configured, true);

  await app.close();
});

test("auth register, login, and me use signed access tokens", async () => {
  const app = await createApp();

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "user@example.com",
      password: "secure-password",
      name: "nomduchat User",
      country: "KZ",
      language: "ru",
    },
  });

  assert.equal(registerResponse.statusCode, 200);
  assert.equal(registerResponse.json().user.email, "user@example.com");
  assert.ok(registerResponse.json().accessToken);

  const duplicateResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "user@example.com",
      password: "secure-password",
    },
  });

  assert.equal(duplicateResponse.statusCode, 409);

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "user@example.com",
      password: "secure-password",
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  const accessToken = loginResponse.json().accessToken;

  const meResponse = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(meResponse.statusCode, 200);
  assert.equal(meResponse.json().user.email, "user@example.com");

  const invalidLoginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "user@example.com",
      password: "wrong-password",
    },
  });

  assert.equal(invalidLoginResponse.statusCode, 401);

  await app.close();
});

test("auth profile exposes role permissions and protects admin-only routes", async () => {
  await withConfig({ ADMIN_EMAILS: "admin@example.com" }, async () => {
    const app = await createApp();

    const userRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "plain@example.com",
        password: "secure-password",
        name: "Plain User",
      },
    });

    assert.equal(userRegisterResponse.statusCode, 200);
    assert.equal(userRegisterResponse.json().user.workspaceRole, "personal");
    assert.equal(userRegisterResponse.json().user.permissions.business, false);
    assert.equal(userRegisterResponse.json().user.permissions.mailings, false);

    const userLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "plain@example.com",
        password: "secure-password",
      },
    });
    assert.equal(userLoginResponse.statusCode, 200);
    assert.equal(userLoginResponse.json().user.permissions.adminPanel, false);

    const adminRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "admin@example.com",
        password: "secure-password",
        name: "Admin User",
      },
    });

    assert.equal(adminRegisterResponse.statusCode, 200);
    assert.equal(adminRegisterResponse.json().user.systemRole, "admin");
    assert.equal(adminRegisterResponse.json().user.permissions.adminPanel, true);
    assert.equal(adminRegisterResponse.json().user.permissions.mailings, true);

    const deniedAdminResponse = await app.inject({
      method: "GET",
      url: "/admin/overview",
      headers: {
        authorization: `Bearer ${userLoginResponse.json().accessToken}`,
      },
    });
    assert.equal(deniedAdminResponse.statusCode, 403);

    const deniedAdminUsersResponse = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: {
        authorization: `Bearer ${userLoginResponse.json().accessToken}`,
      },
    });
    assert.equal(deniedAdminUsersResponse.statusCode, 403);

    const deniedAdminControlResponse = await app.inject({
      method: "GET",
      url: "/admin/control",
      headers: {
        authorization: `Bearer ${userLoginResponse.json().accessToken}`,
      },
    });
    assert.equal(deniedAdminControlResponse.statusCode, 403);

    const adminOverviewResponse = await app.inject({
      method: "GET",
      url: "/admin/overview",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
    });
    assert.equal(adminOverviewResponse.statusCode, 200);
    assert.ok(Array.isArray(adminOverviewResponse.json().businessDirection.metrics));
    assert.ok(typeof adminOverviewResponse.json().memory.totalChats === "number");
    assert.ok(Array.isArray(adminOverviewResponse.json().paymentReport.providers));
    assert.ok(adminOverviewResponse.json().paymentReport.providers.some((provider: { provider: string }) => provider.provider === "kaspi"));
    assert.ok(adminOverviewResponse.json().paymentReport.providers.some((provider: { provider: string }) => provider.provider === "yookassa"));
    assert.ok(Array.isArray(adminOverviewResponse.json().pricing.exchangeRates));
    assert.ok(Array.isArray(adminOverviewResponse.json().pricing.plans));

    const adminControlResponse = await app.inject({
      method: "GET",
      url: "/admin/control",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
    });
    assert.equal(adminControlResponse.statusCode, 200);
    assert.ok(Array.isArray(adminControlResponse.json().featureFlags));
    assert.ok(Array.isArray(adminControlResponse.json().aiProviders));
    assert.ok(Array.isArray(adminControlResponse.json().agents));
    assert.ok(adminControlResponse.json().agents.some((agent: { id: string }) => agent.id === "image"));
    assert.ok(Array.isArray(adminControlResponse.json().promotions));
    assert.ok(Array.isArray(adminControlResponse.json().contentBlocks));
    assert.ok(typeof adminControlResponse.json().note === "string");

    const adminProviderControlResponse = await app.inject({
      method: "PATCH",
      url: "/admin/control/ai-providers/mock-provider",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
      payload: {
        enabled: true,
        model: "mock-control",
        trafficMode: "primary",
      },
    });
    assert.equal(adminProviderControlResponse.statusCode, 200);
    assert.ok(Array.isArray(adminProviderControlResponse.json().aiProviders));

    const adminAgentControlResponse = await app.inject({
      method: "PATCH",
      url: "/admin/control/agents/image",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
      payload: {
        enabled: false,
      },
    });
    assert.equal(adminAgentControlResponse.statusCode, 200);
    assert.ok(
      adminAgentControlResponse.json().agents.some((agent: { id: string; enabled: boolean }) => {
        return agent.id === "image" && agent.enabled === false;
      })
    );

    const adminFeatureControlResponse = await app.inject({
      method: "PATCH",
      url: "/admin/control/feature-flags/chat.files",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
      payload: {
        enabled: false,
        rolloutPercent: 50,
      },
    });
    assert.equal(adminFeatureControlResponse.statusCode, 200);
    assert.ok(Array.isArray(adminFeatureControlResponse.json().featureFlags));

    const adminPromotionControlResponse = await app.inject({
      method: "PATCH",
      url: "/admin/control/promotions/launch-offer",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
      payload: {
        active: false,
        title: "Test launch offer",
      },
    });
    assert.equal(adminPromotionControlResponse.statusCode, 200);
    assert.ok(Array.isArray(adminPromotionControlResponse.json().promotions));

    const adminContentControlResponse = await app.inject({
      method: "PATCH",
      url: "/admin/control/content-blocks/home.hero",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
      payload: {
        locale: "ru",
        title: "Test hero",
      },
    });
    assert.equal(adminContentControlResponse.statusCode, 200);
    assert.ok(Array.isArray(adminContentControlResponse.json().contentBlocks));

    const adminPricingResponse = await app.inject({
      method: "PATCH",
      url: "/admin/pricing",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
      payload: {
        planId: "base",
        country: "KZ",
        amountMinor: 599000,
      },
    });
    assert.equal(adminPricingResponse.statusCode, 200);
    assert.ok(Array.isArray(adminPricingResponse.json().pricing.plans));

    const adminUsersResponse = await app.inject({
      method: "GET",
      url: "/admin/users?q=local",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
    });
    assert.equal(adminUsersResponse.statusCode, 200);
    assert.ok(Array.isArray(adminUsersResponse.json().users));
    assert.ok(typeof adminUsersResponse.json().privacyNote === "string");

    const deniedMailingsResponse = await app.inject({
      method: "GET",
      url: "/mailings/audiences",
      headers: {
        authorization: `Bearer ${userLoginResponse.json().accessToken}`,
      },
    });
    assert.equal(deniedMailingsResponse.statusCode, 403);

    const adminMailingsResponse = await app.inject({
      method: "GET",
      url: "/mailings/audiences",
      headers: {
        authorization: `Bearer ${adminRegisterResponse.json().accessToken}`,
      },
    });
    assert.equal(adminMailingsResponse.statusCode, 200);
    assert.deepEqual(adminMailingsResponse.json().audiences, []);

    await app.close();
  });
});

test("local admin role header opens admin aggregates only in dev/test mode", async () => {
  const app = await createApp();

  const deniedResponse = await app.inject({
    method: "GET",
    url: "/admin/overview",
    headers: {
      "x-nomduchat-local-role": "user",
    },
  });
  assert.equal(deniedResponse.statusCode, 401);

  const adminResponse = await app.inject({
    method: "GET",
    url: "/admin/overview",
    headers: {
      "x-nomduchat-local-role": "admin",
    },
  });
  assert.equal(adminResponse.statusCode, 200);
  assert.ok(Array.isArray(adminResponse.json().businessDirection.metrics));
  assert.ok(Array.isArray(adminResponse.json().pricing.plans));

  await app.close();
});

test("local admin role header cannot open mailings in production mode", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const app = await createApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/mailings/audiences",
      headers: {
        "x-nomduchat-local-role": "admin",
      },
    });

    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("mailings service token opens mailing API in production mode", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  await withConfig({ MAILINGS_API_TOKEN: "repo-mailings-token", MAILINGS_API_USER_ID: "local-user" }, async () => {
    const app = await createApp();

    try {
      const deniedResponse = await app.inject({
        method: "GET",
        url: "/mailings/audiences",
        headers: {
          authorization: "Bearer wrong-token",
        },
      });
      assert.equal(deniedResponse.statusCode, 401);

      const response = await app.inject({
        method: "GET",
        url: "/mailings/audiences",
        headers: {
          authorization: "Bearer repo-mailings-token",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json().audiences, []);
    } finally {
      await app.close();
    }
  });

  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("authenticated workspace routes use bearer user instead of request userId", async () => {
  const app = await createApp();

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "workspace@example.com",
      password: "secure-password",
      name: "Workspace User",
      country: "KZ",
      language: "ru",
    },
  });

  assert.equal(registerResponse.statusCode, 200);
  const registeredUser = registerResponse.json().user;
  const accessToken = registerResponse.json().accessToken;

  const userResponse = await app.inject({
    method: "GET",
    url: "/users/me",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(userResponse.statusCode, 200);
  assert.equal(userResponse.json().email, "workspace@example.com");

  const walletResponse = await app.inject({
    method: "GET",
    url: "/billing/wallet",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(walletResponse.statusCode, 200);
  assert.equal(walletResponse.json().userId, registeredUser.id);
  assert.equal(walletResponse.json().availableCredits, 0);

  const invalidTokenResponse = await app.inject({
    method: "GET",
    url: "/billing/wallet",
    headers: {
      authorization: "Bearer invalid.token.value",
    },
  });

  assert.equal(invalidTokenResponse.statusCode, 401);

  const checkoutResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/checkout",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      userId: "local-user",
      planId: "base",
      country: "KZ",
    },
  });

  assert.equal(checkoutResponse.statusCode, 200);
  assert.equal(checkoutResponse.json().checkout.userId, registeredUser.id);

  const completeResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/mock/complete",
    payload: {
      checkoutId: checkoutResponse.json().checkout.id,
    },
  });

  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json().wallet.userId, registeredUser.id);
  assert.equal(completeResponse.json().wallet.availableCredits, 20_000_000);

  const currentSubscriptionResponse = await app.inject({
    method: "GET",
    url: "/subscriptions/current?userId=local-user",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(currentSubscriptionResponse.statusCode, 200);
  assert.equal(currentSubscriptionResponse.json().subscription.userId, registeredUser.id);
  assert.equal(currentSubscriptionResponse.json().subscription.planId, "base");

  await app.close();
});

test("OAuth start reports unavailable providers until credentials are configured", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/auth/oauth/google/start",
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "provider_unavailable");

  await app.close();
});

test("Google OAuth callback creates a nomduchat session", async () => {
  await withConfig(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      API_PUBLIC_URL: "http://127.0.0.1:4000",
      WEB_APP_URL: "http://127.0.0.1:5173",
    },
    async () => {
      const app = await createApp();

      const startResponse = await app.inject({
        method: "GET",
        url: "/auth/oauth/google/start?returnTo=/workspace/balance",
      });

      assert.equal(startResponse.statusCode, 200);
      const authorizationUrl = new URL(startResponse.json().authorizationUrl);
      assert.equal(authorizationUrl.origin, "https://accounts.google.com");
      assert.equal(authorizationUrl.searchParams.get("client_id"), "google-client");
      assert.equal(authorizationUrl.searchParams.get("redirect_uri"), "http://127.0.0.1:4000/auth/oauth/google/callback");
      const state = authorizationUrl.searchParams.get("state");
      assert.ok(state);

      await withFetchStub(async (input) => {
        const url = String(input);
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({
            access_token: "google-access-token",
          });
        }

        if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
          return jsonResponse({
            sub: "google-user-1",
            email: "google-user@example.com",
            name: "Google User",
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }, async () => {
        const callbackResponse = await app.inject({
          method: "GET",
          url: `/auth/oauth/google/callback?format=json&code=oauth-code&state=${encodeURIComponent(state)}`,
        });

        assert.equal(callbackResponse.statusCode, 200);
        assert.equal(callbackResponse.json().user.email, "google-user@example.com");
        assert.equal(callbackResponse.json().user.name, "Google User");
        assert.equal(callbackResponse.json().returnTo, "/workspace/balance");
        assert.ok(callbackResponse.json().accessToken);
      });

      await app.close();
    }
  );
});

test("GET /agents returns enabled agent registry", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/agents",
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.agents.length >= 4);
  assert.equal(body.agents[0].id, "general");
  assert.ok(body.agents.some((agent: { id: string }) => agent.id === "image"));
  assert.ok(body.agents.some((agent: { id: string }) => agent.id === "video"));
  assert.ok(body.agents.some((agent: { id: string }) => agent.id === "music"));

  await app.close();
});

test("admin can disable an agent from the aggregator", async () => {
  const app = await createApp();

  const disableResponse = await app.inject({
    method: "PATCH",
    url: "/admin/control/agents/music",
    headers: {
      "x-nomduchat-local-role": "admin",
    },
    payload: {
      enabled: false,
    },
  });

  assert.equal(disableResponse.statusCode, 200);
  assert.ok(
    disableResponse.json().agents.some((agent: { id: string; enabled: boolean }) => {
      return agent.id === "music" && agent.enabled === false;
    })
  );

  const publicAgentsResponse = await app.inject({
    method: "GET",
    url: "/agents",
  });
  assert.equal(publicAgentsResponse.statusCode, 200);
  assert.ok(!publicAgentsResponse.json().agents.some((agent: { id: string }) => agent.id === "music"));

  const directAgentResponse = await app.inject({
    method: "GET",
    url: "/agents/music",
  });
  assert.equal(directAgentResponse.statusCode, 404);

  const autoRouteResponse = await app.inject({
    method: "POST",
    url: "/ai/route",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      prompt: "Напиши песню про nomduchat",
    },
  });
  assert.equal(autoRouteResponse.statusCode, 200);
  assert.equal(autoRouteResponse.json().agentId, "general");

  await app.close();
});

test("GET /agents/:id returns 404 for unknown agent", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/agents/unknown",
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");

  await app.close();
});

test("POST /ai/route chooses code agent and model for code tasks", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/ai/route",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      prompt: "Найди ошибку в TypeScript API коде",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.agentId, "code");
  assert.equal(body.provider, "mock-provider");
  assert.equal(body.model, "mock-code");
  assert.equal(body.modality, "code");
  assert.equal(body.asyncJob, false);

  await app.close();
});

test("POST /ai/route allows every country in local provider policy", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/ai/route",
    payload: {
      userId: "local-user",
      country: "RU",
      language: "ru",
      prompt: "Сделай бизнес-план для сервиса",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.provider, "mock-provider");
  assert.equal(body.model, "mock-text");
  assert.equal(body.agentId, "business");
  assert.equal(body.policyMode, "dev_allow_all");

  await app.close();
});

test("POST /ai/route accepts a broad ISO country code list", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/ai/route",
    payload: {
      userId: "local-user",
      country: "US",
      language: "en",
      prompt: "Create a simple study plan",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().provider, "mock-provider");

  await app.close();
});

test("GET /ai/providers exposes configured provider registry", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/ai/providers",
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.policyMode, "dev_allow_all");
  assert.ok(body.providers.some((provider: { code: string }) => provider.code === "openai"));
  assert.ok(body.providers.some((provider: { code: string }) => provider.code === "anthropic"));
  assert.ok(body.providers.some((provider: { code: string }) => provider.code === "gemini"));

  await app.close();
});

test("POST /chat/messages returns a persisted local conversation response", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/chat/messages",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "Помоги написать структуру лендинга для nomduchat",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.conversationId);
  assert.equal(body.userMessage.role, "user");
  assert.equal(body.assistantMessage.role, "assistant");
  assert.equal(body.route.agentId, "general");
  assert.ok(body.usage.estimatedCredits >= 30);
  assert.equal(body.answerVariant.status, "candidate");
  assert.equal(body.answerVariant.assistantMessageId, body.assistantMessage.id);

  await app.close();
});

test("POST /chat/messages accepts text attachments and regenerates the last answer", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/chat/messages",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "Разбери прикрепленный файл",
      attachments: [
        {
          name: "api.ts",
          type: "text/typescript",
          size: 96,
          content: "typescript api code with a bug in request validation",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.route.agentId, "code");
  assert.equal(body.route.modality, "code");
  assert.equal(body.userMessage.metadata.attachments[0].name, "api.ts");
  assert.match(body.userMessage.metadata.attachments[0].content, /typescript api code/);

  const regenerateResponse = await app.inject({
    method: "POST",
    url: "/chat/messages/regenerate",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      conversationId: body.conversationId,
    },
  });

  assert.equal(regenerateResponse.statusCode, 200);
  const regenerateBody = regenerateResponse.json();
  assert.equal(regenerateBody.userMessage.id, body.userMessage.id);
  assert.equal(regenerateBody.assistantMessage.role, "assistant");
  assert.equal(regenerateBody.assistantMessage.metadata.regeneratedFromMessageId, body.userMessage.id);
  assert.equal(regenerateBody.route.agentId, "code");
  assert.equal(regenerateBody.answerVariant.variantIndex, 2);

  const selectResponse = await app.inject({
    method: "POST",
    url: `/chat/answers/${regenerateBody.assistantMessage.id}/select`,
    payload: {
      userId: "local-user",
      conversationId: body.conversationId,
    },
  });

  assert.equal(selectResponse.statusCode, 200);
  assert.equal(selectResponse.json().answerVariant.isSelected, true);
  assert.equal(selectResponse.json().answerVariant.assistantMessageId, regenerateBody.assistantMessage.id);

  const feedbackResponse = await app.inject({
    method: "POST",
    url: `/chat/messages/${regenerateBody.assistantMessage.id}/feedback`,
    payload: {
      userId: "local-user",
      conversationId: body.conversationId,
      rating: "needs_fix",
      reasonTags: ["too_generic"],
      comment: "Нужно больше конкретики.",
    },
  });

  assert.equal(feedbackResponse.statusCode, 200);
  assert.equal(feedbackResponse.json().feedback.rating, "needs_fix");
  assert.equal(feedbackResponse.json().feedback.reasonTags[0], "too_generic");

  await app.close();
});

test("GET /plans returns country-specific subscription pricing", async () => {
  const app = await createApp();

  const kzResponse = await app.inject({
    method: "GET",
    url: "/plans?country=KZ",
  });
  const ruResponse = await app.inject({
    method: "GET",
    url: "/plans?country=RU",
  });

  assert.equal(kzResponse.statusCode, 200);
  assert.equal(ruResponse.statusCode, 200);
  assert.equal(kzResponse.json().plans[0].id, "base");
  assert.equal(kzResponse.json().plans[0].price.provider, "kaspi");
  assert.equal(kzResponse.json().plans[0].price.currency, "KZT");
  assert.equal(ruResponse.json().plans[0].price.provider, "yookassa");
  assert.equal(ruResponse.json().plans[0].price.currency, "RUB");

  await app.close();
});

test("subscription mock checkout activates plan and grants credits once", async () => {
  const app = await createApp();

  const checkoutResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/checkout",
    payload: {
      userId: "local-user",
      planId: "base",
      country: "KZ",
    },
  });

  assert.equal(checkoutResponse.statusCode, 200);
  const checkout = checkoutResponse.json().checkout;
  assert.equal(checkout.provider, "kaspi");
  assert.equal(checkout.status, "pending");
  assert.ok(checkout.providerCheckoutId);

  const completeResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/mock/complete",
    payload: {
      checkoutId: checkout.id,
    },
  });

  assert.equal(completeResponse.statusCode, 200);
  const completeBody = completeResponse.json();
  assert.equal(completeBody.subscription.status, "active");
  assert.equal(completeBody.subscription.planId, "base");
  assert.equal(completeBody.wallet.availableCredits, 20_012_500);

  const repeatedCompleteResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/mock/complete",
    payload: {
      checkoutId: checkout.id,
    },
  });

  assert.equal(repeatedCompleteResponse.statusCode, 200);
  assert.equal(repeatedCompleteResponse.json().wallet.availableCredits, 20_012_500);

  const currentResponse = await app.inject({
    method: "GET",
    url: "/subscriptions/current?userId=local-user",
  });

  assert.equal(currentResponse.statusCode, 200);
  assert.equal(currentResponse.json().subscription.planId, "base");

  const cancelResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/cancel",
    payload: {
      userId: "local-user",
    },
  });

  assert.equal(cancelResponse.statusCode, 200);
  assert.equal(cancelResponse.json().subscription.status, "cancelled");

  await app.close();
});

test("YooKassa webhook activates a pending RU checkout", async () => {
  const app = await createApp();

  const checkoutResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/checkout",
    payload: {
      userId: "local-user",
      planId: "base",
      country: "RU",
    },
  });

  assert.equal(checkoutResponse.statusCode, 200);
  const checkout = checkoutResponse.json().checkout;
  assert.equal(checkout.provider, "yookassa");
  assert.equal(checkout.status, "pending");

  const webhookResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/webhooks/yookassa",
    payload: {
      event: "payment.succeeded",
      object: {
        id: checkout.providerCheckoutId,
      },
    },
  });

  assert.equal(webhookResponse.statusCode, 200);
  assert.equal(webhookResponse.json().subscription.status, "active");
  assert.equal(webhookResponse.json().subscription.provider, "yookassa");
  assert.equal(webhookResponse.json().wallet.availableCredits, 20_012_500);

  const duplicateWebhookResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/webhooks/yookassa",
    payload: {
      event: "payment.succeeded",
      object: {
        id: checkout.providerCheckoutId,
      },
    },
  });

  assert.equal(duplicateWebhookResponse.statusCode, 200);
  assert.equal(duplicateWebhookResponse.json().wallet.availableCredits, 20_012_500);

  const ledgerResponse = await app.inject({
    method: "GET",
    url: "/billing/ledger?userId=local-user",
  });

  assert.equal(ledgerResponse.statusCode, 200);
  assert.equal(
    ledgerResponse.json().entries.filter((entry: { type: string; amountCredits: number }) => entry.type === "topup" && entry.amountCredits === 20_000_000).length,
    1
  );

  await app.close();
});

test("YooKassa canceled webhook closes checkout without granting credits", async () => {
  const app = await createApp();

  const checkoutResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/checkout",
    payload: {
      userId: "local-user",
      planId: "base",
      country: "RU",
    },
  });

  assert.equal(checkoutResponse.statusCode, 200);
  const checkout = checkoutResponse.json().checkout;

  const webhookResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/webhooks/yookassa",
    payload: {
      event: "payment.canceled",
      object: {
        id: checkout.providerCheckoutId,
      },
    },
  });

  assert.equal(webhookResponse.statusCode, 200);
  assert.equal(webhookResponse.json().checkout.status, "cancelled");
  assert.equal(webhookResponse.json().creditsGranted, false);

  const walletResponse = await app.inject({
    method: "GET",
    url: "/billing/wallet?userId=local-user",
  });

  assert.equal(walletResponse.statusCode, 200);
  assert.equal(walletResponse.json().availableCredits, 12_500);

  await app.close();
});

test("GET /business/workspace returns demo CRM, employees, and advisor ideas", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/business/workspace",
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.access.mode, "demo");
  assert.equal(body.access.planRequired, "business");
  assert.equal(body.members.length, 5);
  assert.equal(body.deals[0].id, "alem-beauty");
  assert.ok(body.advisorViews.some((view: { key: string; ideas: unknown[] }) => view.key === "growth" && view.ideas.length > 0));

  const overLimitResponse = await app.inject({
    method: "POST",
    url: "/business/members",
    payload: {
      name: "Еще один сотрудник",
      roleKey: "sales",
    },
  });

  assert.equal(overLimitResponse.statusCode, 400);
  assert.equal(overLimitResponse.json().error.code, "validation_failed");

  await app.close();
});

test("business workspace persists CRM notes and advisor idea statuses", async () => {
  const app = await createApp();

  const noteResponse = await app.inject({
    method: "POST",
    url: "/business/deals/alem-beauty/notes",
    payload: {
      text: "Попросили показать демо бота для записи.",
    },
  });

  assert.equal(noteResponse.statusCode, 200);
  const noteBody = noteResponse.json();
  const deal = noteBody.deals.find((candidate: { id: string }) => candidate.id === "alem-beauty");
  assert.ok(deal.notes.some((note: { text: string }) => note.text === "Попросили показать демо бота для записи."));

  const ideaResponse = await app.inject({
    method: "PATCH",
    url: "/business/ideas/sales-script",
    payload: {
      status: "in_progress",
    },
  });

  assert.equal(ideaResponse.statusCode, 200);
  const updatedIdea = ideaResponse
    .json()
    .advisorViews.flatMap((view: { ideas: Array<{ id: string; status: string }> }) => view.ideas)
    .find((idea: { id: string }) => idea.id === "sales-script");
  assert.equal(updatedIdea.status, "in_progress");

  await app.close();
});

test("business subscription switches workspace access from demo to active", async () => {
  const app = await createApp();

  const checkoutResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/checkout",
    payload: {
      userId: "local-user",
      planId: "business",
      country: "KZ",
    },
  });

  assert.equal(checkoutResponse.statusCode, 200);

  const completeResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/mock/complete",
    payload: {
      checkoutId: checkoutResponse.json().checkout.id,
    },
  });

  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json().subscription.planId, "business");

  const workspaceResponse = await app.inject({
    method: "GET",
    url: "/business/workspace",
  });

  assert.equal(workspaceResponse.statusCode, 200);
  assert.equal(workspaceResponse.json().access.mode, "active");
  assert.equal(workspaceResponse.json().access.subscriptionPlanId, "business");
  assert.ok(workspaceResponse.json().groups[0].name.includes("общая группа"));
  assert.ok(workspaceResponse.json().employeeReports.length > 0);

  await app.close();
});

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
