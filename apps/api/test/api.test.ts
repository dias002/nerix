import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../src/config.js";
import type { DatabaseClient, DatabaseQueryResult } from "../src/database/index.js";
import type { PasswordResetMailer, PasswordResetMailInput } from "../src/modules/auth/password-reset-mailer.js";
import type { MailingTransport, SendMassEmailInput } from "../src/modules/mailings/smtp-bz.client.js";
import { AbuseGuardService, InMemoryAbuseRateLimitRepository } from "../src/modules/security/abuse-guard.js";
import { createApp } from "../src/server/create-app.js";
import { createDependencies } from "../src/server/dependencies.js";

test("GET /health returns service status", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.headers["x-request-id"], "string");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.equal(response.headers["x-frame-options"], "DENY");
  assert.deepEqual(response.json(), {
    ok: true,
    service: "nomduchat-api",
    version: "0.1.0",
  });

  await app.close();
});

test("API responses preserve safe request ids and include them in errors", async () => {
  const app = await createApp();
  const requestId = "nomduchat-test-request-01";

  const response = await app.inject({
    method: "POST",
    url: "/ai/route",
    headers: {
      "x-request-id": requestId,
    },
    payload: {},
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.headers["x-request-id"], requestId);
  assert.equal(response.json().error.code, "validation_failed");
  assert.equal(response.json().error.requestId, requestId);

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

test("GET /geo/country detects supported countries from proxy headers", async () => {
  const app = await createApp();

  const cloudflareResponse = await app.inject({
    method: "GET",
    url: "/geo/country",
    headers: {
      "cf-ipcountry": "RU",
    },
  });

  assert.equal(cloudflareResponse.statusCode, 200);
  assert.deepEqual(cloudflareResponse.json(), {
    country: "RU",
    source: "header",
  });

  const vercelResponse = await app.inject({
    method: "GET",
    url: "/geo/country",
    headers: {
      "x-vercel-ip-country": "KZ",
    },
  });

  assert.equal(vercelResponse.statusCode, 200);
  assert.deepEqual(vercelResponse.json(), {
    country: "KZ",
    source: "header",
  });

  const unknownResponse = await app.inject({
    method: "GET",
    url: "/geo/country",
  });

  assert.equal(unknownResponse.statusCode, 200);
  assert.deepEqual(unknownResponse.json(), {
    country: null,
    source: "unknown",
  });

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

test("GET /content/blocks exposes seeded workspace articles without authentication", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/content/blocks?placement=workspace.home.articles&locale=ru",
  });

  assert.equal(response.statusCode, 200);
  const contentBlocks = response.json().contentBlocks;
  assert.equal(contentBlocks.length, 3);
  assert.deepEqual(
    new Set(contentBlocks.map((block: { key: string }) => block.key)),
    new Set([
      "workspace.home.article.images",
      "workspace.home.article.video",
      "workspace.home.article.humanizer",
    ])
  );
  for (const block of contentBlocks) {
    assert.equal(block.locale, "ru");
    assert.equal(block.placement, "workspace.home.articles");
    assert.ok(block.body.split(/\n\s*\n/).length >= 2);
    assert.deepEqual(Object.keys(block).sort(), ["body", "key", "locale", "placement", "title", "updatedAt"]);
  }

  const missingPlacementResponse = await app.inject({
    method: "GET",
    url: "/content/blocks?locale=ru",
  });
  assert.equal(missingPlacementResponse.statusCode, 400);

  await app.close();
});

test("GET /content/blocks filters inactive records, placement, and locale", async () => {
  const rows = [
    {
      key: "workspace.home.article.visible",
      locale: "ru",
      title: "Visible",
      body: "Visible body",
      placement: "workspace.home.articles",
      active: true,
      updated_at: "2026-07-22T00:00:00.000Z",
    },
    {
      key: "workspace.home.article.hidden",
      locale: "ru",
      title: "Hidden",
      body: "Hidden body",
      placement: "workspace.home.articles",
      active: false,
      updated_at: "2026-07-22T00:00:00.000Z",
    },
    {
      key: "workspace.home.article.english",
      locale: "en",
      title: "English",
      body: "English body",
      placement: "workspace.home.articles",
      active: true,
      updated_at: "2026-07-22T00:00:00.000Z",
    },
    {
      key: "home.hero",
      locale: "ru",
      title: "Other placement",
      body: "Other body",
      placement: "home",
      active: true,
      updated_at: "2026-07-22T00:00:00.000Z",
    },
  ];
  const database: DatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string): Promise<DatabaseQueryResult<T>> {
      if (text.includes("from content_blocks")) {
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }
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
    url: "/content/blocks?placement=workspace.home.articles&locale=ru",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().contentBlocks.map((block: { key: string }) => block.key), [
    "workspace.home.article.visible",
  ]);

  await app.close();
});

test("GET /workspace/features exposes shared feature visibility matrix for guests", async () => {
  const app = await createApp();

  const listResponse = await app.inject({
    method: "GET",
    url: "/workspace/features",
  });
  assert.equal(listResponse.statusCode, 200);

  const listBody = listResponse.json();
  const featureMap = new Map(listBody.features.map((feature: { path: string; status: string }) => [feature.path, feature.status]));

  assert.equal(featureMap.get("/workspace/admin"), "hidden");
  assert.equal(featureMap.get("/workspace/avatar"), "ready");
  assert.equal(featureMap.get("/workspace/chat"), "ready");
  assert.equal(listBody.access.isGuest, false);
  assert.equal(listBody.access.canUseSettings, true);

  const avatarStatusResponse = await app.inject({
    method: "GET",
    url: "/workspace/features?pathname=/workspace/avatar",
  });
  assert.equal(avatarStatusResponse.statusCode, 200);
  const avatarStatusBody = avatarStatusResponse.json();
  assert.equal(avatarStatusBody.currentPath, "/workspace/avatar");
  assert.equal(avatarStatusBody.currentStatus, "ready");

  await app.close();
});

test("GET /workspace/features gates admin and balance for regular user", async () => {
  const app = await createApp();

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "feature-user@example.com",
      password: "secure-password",
      name: "Feature User",
      country: "KZ",
      language: "ru",
    },
  });
  assert.equal(registerResponse.statusCode, 200);
  const accessToken = registerResponse.json().accessToken;

  const profileFeatureResponse = await app.inject({
    method: "GET",
    url: "/workspace/features?pathname=/workspace/settings/profile",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  assert.equal(profileFeatureResponse.statusCode, 200);
  const profileFeatureBody = profileFeatureResponse.json();
  assert.equal(profileFeatureBody.currentStatus, "ready");

  const adminStatusResponse = await app.inject({
    method: "GET",
    url: "/workspace/features?pathname=/workspace/admin",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  assert.equal(adminStatusResponse.statusCode, 200);
  assert.equal(adminStatusResponse.json().currentStatus, "hidden");

  const invalidQueryResponse = await app.inject({
    method: "GET",
    url: "/workspace/features?pathname=",
  });
  assert.equal(invalidQueryResponse.statusCode, 400);

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

test("app review account accepts the review password even if stored password changed", async () => {
  const app = await createApp();

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "apple.review@nomduchat.com",
      password: "different-secure-password",
      name: "Apple Review",
      country: "KZ",
      language: "en",
    },
  });

  assert.equal(registerResponse.statusCode, 200);

  const invalidLoginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "apple.review@nomduchat.com",
      password: "wrong-password",
    },
  });

  assert.equal(invalidLoginResponse.statusCode, 401);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "apple.review@nomduchat.com",
        password: "NomduchatReview2026!",
      },
    });

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.json().user.email, "apple.review@nomduchat.com");
    assert.ok(loginResponse.json().accessToken);
  }

  await app.close();
});

test("authenticated user can update profile fields and avatar", async () => {
  const app = await createApp();

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "profile@example.com",
      password: "secure-password",
      name: "Old Name",
      country: "KZ",
      language: "ru",
    },
  });

  assert.equal(registerResponse.statusCode, 200);
  const accessToken = registerResponse.json().accessToken;
  const avatarDataUrl = "data:image/png;base64,iVBORw0KGgo=";

  const updateResponse = await app.inject({
    method: "PATCH",
    url: "/users/me",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      name: "Profile Name",
      country: "US",
      language: "en",
      avatarDataUrl,
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().user.name, "Profile Name");
  assert.equal(updateResponse.json().user.country, "US");
  assert.equal(updateResponse.json().user.language, "en");
  assert.equal(updateResponse.json().user.avatarUrl, avatarDataUrl);

  const meResponse = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  assert.equal(meResponse.statusCode, 200);
  assert.equal(meResponse.json().user.avatarUrl, avatarDataUrl);

  await app.close();
});

test("support ticket route stores request and sends best-effort email", async () => {
  const transport = new FakeMailingTransport();
  const app = await createApp({
    dependencies: createDependencies({ mailingTransport: transport }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/support/tickets",
    payload: {
      name: "Support User",
      email: "support-user@example.com",
      topic: "technical",
      message: "Не получается отправить запрос из приложения.",
      pageUrl: "https://nomduchat.com/support",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().ticket.email, "support-user@example.com");
  assert.equal(response.json().ticket.status, "open");
  assert.equal(transport.lastSend?.replyTo, "support-user@example.com");
  assert.equal(transport.lastSend?.contacts[0]?.email, config.SUPPORT_EMAIL);

  await app.close();
});
test("auth password reset sends one-time link and updates password", async () => {
  const passwordResetMailer = new FakePasswordResetMailer();
  const app = await createApp({
    dependencies: createDependencies({ passwordResetMailer }),
  });

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "reset@example.com",
      password: "old-secure-password",
      name: "Reset User",
    },
  });

  assert.equal(registerResponse.statusCode, 200);

  const requestResponse = await app.inject({
    method: "POST",
    url: "/auth/password-reset/request",
    payload: {
      email: "reset@example.com",
    },
  });

  assert.equal(requestResponse.statusCode, 200);
  assert.equal(requestResponse.json().accepted, true);
  assert.ok(passwordResetMailer.lastEmail);
  assert.equal(passwordResetMailer.lastEmail?.email, "reset@example.com");
  const token = new URL(passwordResetMailer.lastEmail!.resetUrl).searchParams.get("token");
  assert.ok(token);

  const confirmResponse = await app.inject({
    method: "POST",
    url: "/auth/password-reset/confirm",
    payload: {
      token,
      password: "new-secure-password",
    },
  });

  assert.equal(confirmResponse.statusCode, 200);
  assert.equal(confirmResponse.json().user.email, "reset@example.com");
  assert.ok(confirmResponse.json().accessToken);

  const oldLoginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "reset@example.com",
      password: "old-secure-password",
    },
  });
  assert.equal(oldLoginResponse.statusCode, 401);

  const newLoginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "reset@example.com",
      password: "new-secure-password",
    },
  });
  assert.equal(newLoginResponse.statusCode, 200);

  const reusedTokenResponse = await app.inject({
    method: "POST",
    url: "/auth/password-reset/confirm",
    payload: {
      token,
      password: "another-secure-password",
    },
  });
  assert.equal(reusedTokenResponse.statusCode, 400);

  const missingEmailResponse = await app.inject({
    method: "POST",
    url: "/auth/password-reset/request",
    payload: {
      email: "missing@example.com",
    },
  });

  assert.equal(missingEmailResponse.statusCode, 200);
  assert.equal(missingEmailResponse.json().accepted, true);

  await app.close();
});

test("abuse guard rate-limits repeated registrations from the same device", async () => {
  const abuseGuard = new AbuseGuardService(new InMemoryAbuseRateLimitRepository(), {
    enabled: true,
    hashSecret: "test-abuse-secret",
    turnstileRequired: false,
  });
  const app = await createApp({
    dependencies: createDependencies({ abuseGuard }),
  });

  for (let index = 0; index < 3; index += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: {
        "x-nomduchat-device-id": "repeat-registration-device",
      },
      payload: {
        email: `register-limit-${index}@example.com`,
        password: "secure-password",
      },
    });

    assert.equal(response.statusCode, 200);
  }

  const blockedResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: {
      "x-nomduchat-device-id": "repeat-registration-device",
    },
    payload: {
      email: "register-limit-blocked@example.com",
      password: "secure-password",
    },
  });

  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.json().error.code, "rate_limit_exceeded");

  await app.close();
});

test("abuse guard rate-limits public AI route probes", async () => {
  const abuseGuard = new AbuseGuardService(new InMemoryAbuseRateLimitRepository(), {
    enabled: true,
    hashSecret: "test-abuse-secret",
    turnstileRequired: false,
  });
  const app = await createApp({
    dependencies: createDependencies({ abuseGuard }),
  });

  for (let index = 0; index < 60; index += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/ai/route",
      headers: {
        "x-nomduchat-device-id": "ai-route-probe-device",
      },
      payload: {
        prompt: "hello",
      },
    });

    assert.notEqual(response.statusCode, 429);
  }

  const blockedResponse = await app.inject({
    method: "POST",
    url: "/ai/route",
    headers: {
      "x-nomduchat-device-id": "ai-route-probe-device",
    },
    payload: {
      prompt: "hello",
    },
  });

  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.json().error.code, "rate_limit_exceeded");

  await app.close();
});

test("user can export and permanently delete own account data", async () => {
  const app = await createApp();

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "delete-me@example.com",
      password: "secure-password",
      name: "Delete Me",
      country: "KZ",
      language: "ru",
    },
  });

  assert.equal(registerResponse.statusCode, 200);
  const accessToken = registerResponse.json().accessToken;

  const exportResponse = await app.inject({
    method: "GET",
    url: "/users/me/export",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(exportResponse.statusCode, 200);
  assert.equal(exportResponse.json().user.email, "delete-me@example.com");
  assert.equal(typeof exportResponse.json().generatedAt, "string");

  const blockedDeleteResponse = await app.inject({
    method: "POST",
    url: "/users/me/delete",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      confirmation: "delete",
    },
  });

  assert.equal(blockedDeleteResponse.statusCode, 400);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: "/users/me",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      confirmation: "DELETE",
    },
  });

  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.json().deleted, true);
  assert.equal(deleteResponse.json().emailBeforeDeletion, "delete-me@example.com");
  assert.ok(deleteResponse.json().retainedRecords.includes("subscription_checkouts"));

  const oldSessionResponse = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  assert.equal(oldSessionResponse.statusCode, 404);

  const oldLoginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "delete-me@example.com",
      password: "secure-password",
    },
  });
  assert.equal(oldLoginResponse.statusCode, 401);

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
    assert.ok(Array.isArray(adminControlResponse.json().integrationChecks));
    assert.ok(
      adminControlResponse.json().integrationChecks.some((check: { key: string }) => check.key === "oauth.yandex")
    );
    assert.ok(
      adminControlResponse.json().integrationChecks.some((check: { key: string }) => check.key === "mail.lifecycle")
    );
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

test("production workspace routes require bearer auth instead of local fallback", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const app = await createApp();

  try {
    const walletResponse = await app.inject({
      method: "GET",
      url: "/billing/wallet",
    });
    assert.equal(walletResponse.statusCode, 401);

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/subscriptions/checkout",
      payload: {
        userId: "local-user",
        planId: "base",
        country: "KZ",
      },
    });
    assert.equal(checkoutResponse.statusCode, 401);
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

  const attackerRegisterResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "workspace-attacker@example.com",
      password: "secure-password",
      name: "Workspace Attacker",
    },
  });
  assert.equal(attackerRegisterResponse.statusCode, 200);

  const attackerCompleteResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/mock/complete",
    headers: {
      authorization: `Bearer ${attackerRegisterResponse.json().accessToken}`,
    },
    payload: {
      checkoutId: checkoutResponse.json().checkout.id,
    },
  });
  assert.equal(attackerCompleteResponse.statusCode, 404);

  const completeResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/mock/complete",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    payload: {
      checkoutId: checkoutResponse.json().checkout.id,
    },
  });

  assert.equal(completeResponse.statusCode, 200);
  assert.equal(completeResponse.json().wallet.userId, registeredUser.id);
  assert.equal(completeResponse.json().wallet.availableCredits, 2_000);

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

test("Google OAuth start is blocked for RU accounts", async () => {
  await withConfig(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      API_PUBLIC_URL: "http://127.0.0.1:4000",
      WEB_APP_URL: "http://127.0.0.1:5173",
    },
    async () => {
      const app = await createApp();

      const response = await app.inject({
        method: "GET",
        url: "/auth/oauth/google/start?country=RU",
      });

      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error.code, "provider_unavailable");

      await app.close();
    }
  );
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

        const linkedResponse = await app.inject({
          method: "GET",
          url: "/auth/linked-accounts",
          headers: {
            authorization: `Bearer ${callbackResponse.json().accessToken}`,
          },
        });

        assert.equal(linkedResponse.statusCode, 200);
        assert.equal(linkedResponse.json().accounts.length, 1);
        assert.equal(linkedResponse.json().accounts[0].provider, "google");
        assert.equal(linkedResponse.json().accounts[0].email, "google-user@example.com");

        const blockedUnlinkResponse = await app.inject({
          method: "POST",
          url: "/auth/linked-accounts/google/unlink",
          headers: {
            authorization: `Bearer ${callbackResponse.json().accessToken}`,
          },
        });

        assert.equal(blockedUnlinkResponse.statusCode, 400);
        assert.equal(blockedUnlinkResponse.json().error.code, "validation_failed");
      });

      await app.close();
    }
  );
});

test("OAuth account linked to password user can be listed and unlinked", async () => {
  await withConfig(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      API_PUBLIC_URL: "http://127.0.0.1:4000",
      WEB_APP_URL: "http://127.0.0.1:5173",
    },
    async () => {
      const app = await createApp();

      const registerResponse = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "linked-google@example.com",
          password: "secure-password",
          name: "Linked User",
        },
      });
      assert.equal(registerResponse.statusCode, 200);

      const startResponse = await app.inject({
        method: "GET",
        url: "/auth/oauth/google/start",
      });
      assert.equal(startResponse.statusCode, 200);
      const state = new URL(startResponse.json().authorizationUrl).searchParams.get("state");
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
            sub: "google-linked-1",
            email: "linked-google@example.com",
            name: "Linked Google",
          });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }, async () => {
        const callbackResponse = await app.inject({
          method: "GET",
          url: `/auth/oauth/google/callback?format=json&code=oauth-code&state=${encodeURIComponent(state)}`,
        });

        assert.equal(callbackResponse.statusCode, 200);
        const accessToken = callbackResponse.json().accessToken;

        const linkedResponse = await app.inject({
          method: "GET",
          url: "/auth/linked-accounts",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });

        assert.equal(linkedResponse.statusCode, 200);
        assert.equal(linkedResponse.json().accounts.length, 1);
        assert.equal(linkedResponse.json().accounts[0].provider, "google");

        const unlinkResponse = await app.inject({
          method: "POST",
          url: "/auth/linked-accounts/google/unlink",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });

        assert.equal(unlinkResponse.statusCode, 200);
        assert.equal(unlinkResponse.json().provider, "google");
        assert.equal(unlinkResponse.json().unlinked, true);
        assert.deepEqual(unlinkResponse.json().accounts, []);
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
  assert.equal(body.taskType, "code_generation");
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
  assert.equal(body.taskType, "internal_analysis");
  assert.equal(body.policyMode, "dev_allow_all");

  await app.close();
});

test("POST /ai/route treats websites and Telegram bots as business tasks", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/ai/route",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      prompt: "Создай сайт и Telegram-бота для отдела продаж",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.agentId, "business");
  assert.equal(body.modality, "text");
  assert.equal(body.taskType, "website_copy");
  assert.equal(body.provider, "mock-provider");

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
  assert.ok(body.models.some((model: { id: string }) => model.id === "mock-provider:configured"));

  await app.close();
});

test("project routes create, update, list, and delete workspace projects", async () => {
  const app = await createApp();

  const createResponse = await app.inject({
    method: "POST",
    url: "/projects",
    payload: {
      title: "SEO-раздел",
      description: "Собрать статьи и FAQ для индексации.",
      projectType: "content",
    },
  });

  assert.equal(createResponse.statusCode, 200);
  const created = createResponse.json().project;
  assert.equal(created.title, "SEO-раздел");
  assert.equal(created.projectType, "content");
  assert.equal(created.status, "planned");

  const listResponse = await app.inject({
    method: "GET",
    url: "/projects",
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().projects.length, 1);
  assert.equal(listResponse.json().projects[0].id, created.id);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/projects/${created.id}`,
    payload: {
      status: "active",
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().project.status, "active");

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/projects/${created.id}`,
  });

  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.json().deleted, true);

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
      selectedModelId: "mock-provider:configured",
      message: "Помоги написать структуру лендинга для nomduchat",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.conversationId);
  assert.equal(body.userMessage.role, "user");
  assert.equal(body.assistantMessage.role, "assistant");
  assert.equal(body.route.agentId, "general");
  assert.equal(body.route.model, "mock-text");
  assert.equal(body.userMessage.metadata.requestedModelId, "mock-provider:configured");
  assert.ok(body.usage.estimatedCredits >= 30);
  assert.equal(body.answerVariant.status, "candidate");
  assert.equal(body.answerVariant.assistantMessageId, body.assistantMessage.id);

  await app.close();
});

test("POST /chat/messages/stream emits start, delta, and done events", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "POST",
    url: "/chat/messages/stream",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      selectedModelId: "mock-provider:configured",
      message: "Проверь потоковый ответ",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["content-type"]), /text\/event-stream/);

  const events = parseSseEvents(response.payload);
  assert.equal(events[0].event, "start");
  assert.equal(events.at(-1)?.event, "done");
  assert.ok(events.slice(1, -1).every((event) => event.event === "delta"));
  assert.equal(events[0].data.userMessage.role, "user");
  assert.equal(events[0].data.route.model, "mock-text");
  assert.match(events.slice(1, -1).map((event) => event.data.delta).join(""), /mock-ответ nomduchat/);
  assert.equal(events.at(-1)?.data.assistantMessage.role, "assistant");
  assert.equal(events.at(-1)?.data.answerVariant.status, "candidate");

  await app.close();
});

test("free chat accounts have seven daily text requests and paid media gate", async () => {
  const app = await createApp();

  const initialLimitsResponse = await app.inject({
    method: "GET",
    url: "/usage/limits",
  });

  assert.equal(initialLimitsResponse.statusCode, 200);
  assert.equal(initialLimitsResponse.json().text.dailyLimit, 7);
  assert.equal(initialLimitsResponse.json().text.remainingToday, 7);
  assert.equal(initialLimitsResponse.json().media.video, false);
  assert.equal(initialLimitsResponse.json().media.music, false);

  const mediaResponse = await app.inject({
    method: "POST",
    url: "/chat/messages",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "Сгенерируй картинку логотипа для кофейни",
    },
  });

  assert.equal(mediaResponse.statusCode, 402);
  assert.equal(mediaResponse.json().error.code, "subscription_required");

  const songResponse = await app.inject({
    method: "POST",
    url: "/chat/messages",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "Сочини песню про Казахстан",
    },
  });

  assert.equal(songResponse.statusCode, 402);
  assert.equal(songResponse.json().error.code, "subscription_required");

  let lastConversationId = "";
  for (let index = 0; index < 6; index += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/chat/messages",
      payload: {
        userId: "local-user",
        country: "KZ",
        language: "ru",
        message: `Текстовый вопрос ${index + 1}`,
      },
    });

    assert.equal(response.statusCode, 200);
    lastConversationId = response.json().conversationId;
  }

  const regenerateResponse = await app.inject({
    method: "POST",
    url: "/chat/messages/regenerate",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      conversationId: lastConversationId,
    },
  });

  assert.equal(regenerateResponse.statusCode, 200);

  const usedLimitsResponse = await app.inject({
    method: "GET",
    url: "/usage/limits",
  });

  assert.equal(usedLimitsResponse.statusCode, 200);
  assert.equal(usedLimitsResponse.json().text.usedToday, 7);
  assert.equal(usedLimitsResponse.json().text.remainingToday, 0);

  const overLimitResponse = await app.inject({
    method: "POST",
    url: "/chat/messages",
    payload: {
      userId: "local-user",
      country: "KZ",
      language: "ru",
      message: "Еще один текстовый вопрос",
    },
  });

  assert.equal(overLimitResponse.statusCode, 402);
  assert.equal(overLimitResponse.json().error.code, "daily_text_limit_exceeded");

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
  assert.equal(kzResponse.json().plans[0].monthlyCredits, 2_000);
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
  assert.equal(completeBody.wallet.availableCredits, 14_500);

  const repeatedCompleteResponse = await app.inject({
    method: "POST",
    url: "/subscriptions/mock/complete",
    payload: {
      checkoutId: checkout.id,
    },
  });

  assert.equal(repeatedCompleteResponse.statusCode, 200);
  assert.equal(repeatedCompleteResponse.json().wallet.availableCredits, 14_500);

  const currentResponse = await app.inject({
    method: "GET",
    url: "/subscriptions/current?userId=local-user",
  });

  assert.equal(currentResponse.statusCode, 200);
  assert.equal(currentResponse.json().subscription.planId, "base");

  const checkoutsResponse = await app.inject({
    method: "GET",
    url: "/subscriptions/checkouts",
  });

  assert.equal(checkoutsResponse.statusCode, 200);
  assert.equal(checkoutsResponse.json().checkouts.length, 1);
  assert.equal(checkoutsResponse.json().checkouts[0].id, checkout.id);
  assert.equal(checkoutsResponse.json().checkouts[0].status, "completed");

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

test("RU subscription checkout requires customer email for YooKassa receipt", async () => {
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

  assert.equal(checkoutResponse.statusCode, 400);
  assert.equal(checkoutResponse.json().error.code, "validation_failed");
  assert.match(checkoutResponse.json().error.message, /Customer email/);

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
      customerEmail: "buyer@example.com",
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
  assert.equal(webhookResponse.json().wallet.availableCredits, 14_500);

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
  assert.equal(duplicateWebhookResponse.json().wallet.availableCredits, 14_500);

  const ledgerResponse = await app.inject({
    method: "GET",
    url: "/billing/ledger?userId=local-user",
  });

  assert.equal(ledgerResponse.statusCode, 200);
  assert.equal(
    ledgerResponse.json().entries.filter((entry: { type: string; amountCredits: number }) => entry.type === "topup" && entry.amountCredits === 2_000).length,
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
      customerEmail: "buyer@example.com",
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

test("YooKassa webhook accepts configured secret in query string", async () => {
  await withConfig({ PAYMENT_WEBHOOK_SECRET: "webhook-secret" }, async () => {
    const app = await createApp();

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/subscriptions/checkout",
      payload: {
        userId: "local-user",
        planId: "base",
        country: "RU",
        customerEmail: "buyer@example.com",
      },
    });

    assert.equal(checkoutResponse.statusCode, 200);
    const checkout = checkoutResponse.json().checkout;

    const blockedWebhookResponse = await app.inject({
      method: "POST",
      url: "/subscriptions/webhooks/yookassa",
      payload: {
        event: "payment.succeeded",
        object: {
          id: checkout.providerCheckoutId,
        },
      },
    });

    assert.equal(blockedWebhookResponse.statusCode, 401);

    const webhookResponse = await app.inject({
      method: "POST",
      url: "/subscriptions/webhooks/yookassa?secret=webhook-secret",
      payload: {
        event: "payment.succeeded",
        object: {
          id: checkout.providerCheckoutId,
        },
      },
    });

    assert.equal(webhookResponse.statusCode, 200);
    assert.equal(webhookResponse.json().subscription.status, "active");

    await app.close();
  });
});

test("GET /business/workspace returns demo CRM, employees, and advisor ideas", async () => {
  const app = await createApp();
  const businessOwnerHeaders = { "x-nomduchat-local-role": "business_owner" };

  const personalResponse = await app.inject({
    method: "GET",
    url: "/business/workspace",
    headers: { "x-nomduchat-local-role": "user" },
  });

  assert.equal(personalResponse.statusCode, 403);
  assert.equal(personalResponse.json().error.code, "unauthorized");

  const response = await app.inject({
    method: "GET",
    url: "/business/workspace",
    headers: businessOwnerHeaders,
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
    headers: businessOwnerHeaders,
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
  const businessOwnerHeaders = { "x-nomduchat-local-role": "business_owner" };

  const noteResponse = await app.inject({
    method: "POST",
    url: "/business/deals/alem-beauty/notes",
    headers: businessOwnerHeaders,
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
    headers: businessOwnerHeaders,
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
  const businessOwnerHeaders = { "x-nomduchat-local-role": "business_owner" };

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
    headers: businessOwnerHeaders,
  });

  assert.equal(workspaceResponse.statusCode, 200);
  assert.equal(workspaceResponse.json().access.mode, "active");
  assert.equal(workspaceResponse.json().access.subscriptionPlanId, "business");
  assert.ok(workspaceResponse.json().groups[0].name.includes("общая группа"));
  assert.ok(workspaceResponse.json().employeeReports.length > 0);

  await app.close();
});

test("business operations store customer conversations, analysis, ratings, and team chat", async () => {
  const app = await createApp();
  const businessOwnerHeaders = { "x-nomduchat-local-role": "business_owner" };

  const initialResponse = await app.inject({
    method: "GET",
    url: "/business/ops",
    headers: businessOwnerHeaders,
  });

  assert.equal(initialResponse.statusCode, 200);
  assert.equal(initialResponse.json().conversations.length, 0);
  assert.equal(initialResponse.json().metrics[0].label, "Диалоги");

  const createResponse = await app.inject({
    method: "POST",
    url: "/business/ops/conversations",
    headers: businessOwnerHeaders,
    payload: {
      channel: "telegram",
      customerName: "Nomdu Cafe",
      customerContact: "@nomdu_cafe",
      source: "@nomdu_cafe_bot",
      trainingAllowed: true,
      messages: [
        {
          role: "customer",
          content: "Здравствуйте. Нужен Telegram-бот, цена и сроки запуска. Если дорого, подумаем позже.",
        },
        {
          role: "bot",
          content: "Могу собрать заявку. Уточните город, задачу бота и контакт менеджера.",
        },
      ],
    },
  });

  assert.equal(createResponse.statusCode, 200);
  const created = createResponse.json().conversation;
  assert.equal(created.channel, "telegram");
  assert.equal(created.trainingAllowed, true);
  assert.ok(created.analysis.objections.includes("сомнение в цене"));
  assert.ok(created.analysis.desiredProducts.includes("Telegram-бот"));
  assert.equal(createResponse.json().overview.conversations.length, 1);

  const messageResponse = await app.inject({
    method: "POST",
    url: `/business/ops/conversations/${created.id}/messages`,
    headers: businessOwnerHeaders,
    payload: {
      role: "customer",
      content: "Готовы созвониться, передайте менеджеру расчет.",
    },
  });

  assert.equal(messageResponse.statusCode, 200);
  assert.equal(messageResponse.json().conversation.messages.length, 3);
  assert.equal(messageResponse.json().conversation.status, "waiting_human");

  const ratingResponse = await app.inject({
    method: "PATCH",
    url: `/business/ops/conversations/${created.id}/rating`,
    headers: businessOwnerHeaders,
    payload: {
      rating: "excellent",
    },
  });

  assert.equal(ratingResponse.statusCode, 200);
  assert.equal(ratingResponse.json().conversation.ownerRating, "excellent");
  assert.equal(ratingResponse.json().overview.metrics[4].value, "1");

  const teamMessageResponse = await app.inject({
    method: "POST",
    url: "/business/ops/team/messages",
    headers: businessOwnerHeaders,
    payload: {
      authorName: "Egor",
      roleTitle: "Владелец",
      text: "Проверьте расчет для Nomdu Cafe и заберите диалог.",
    },
  });

  assert.equal(teamMessageResponse.statusCode, 200);
  assert.equal(teamMessageResponse.json().message.authorName, "Egor");
  assert.equal(teamMessageResponse.json().overview.teamMessages.length, 1);

  await app.close();
});

test("business employee handles dialogs without owner-only review controls", async () => {
  const app = await createApp();
  const businessEmployeeHeaders = { "x-nomduchat-local-role": "business_employee" };

  const createResponse = await app.inject({
    method: "POST",
    url: "/business/ops/conversations",
    headers: businessEmployeeHeaders,
    payload: {
      channel: "manual",
      customerName: "Employee Lead",
      trainingAllowed: true,
      messages: [
        {
          role: "customer",
          content: "Хочу узнать цену и сроки запуска.",
        },
      ],
    },
  });

  assert.equal(createResponse.statusCode, 200);
  const conversation = createResponse.json().conversation;
  assert.equal(conversation.trainingAllowed, false);

  const messageResponse = await app.inject({
    method: "POST",
    url: `/business/ops/conversations/${conversation.id}/messages`,
    headers: businessEmployeeHeaders,
    payload: {
      role: "customer",
      content: "Добавьте расчет менеджеру.",
    },
  });

  assert.equal(messageResponse.statusCode, 200);

  const ratingResponse = await app.inject({
    method: "PATCH",
    url: `/business/ops/conversations/${conversation.id}/rating`,
    headers: businessEmployeeHeaders,
    payload: {
      rating: "excellent",
    },
  });

  assert.equal(ratingResponse.statusCode, 403);
  assert.equal(ratingResponse.json().error.code, "unauthorized");

  await app.close();
});

test("business website builder creates, edits, publishes, and serves a public site", async () => {
  const app = await createApp();
  const businessOwnerHeaders = { "x-nomduchat-local-role": "business_owner" };

  const knowledgeResponse = await app.inject({
    method: "POST",
    url: "/business/knowledge-base",
    headers: businessOwnerHeaders,
    payload: {
      type: "faq",
      title: "Доставка и оплата",
      content: "Доставка по Алматы в день заказа. Оплата Kaspi и картой.",
      tags: ["delivery", "payment"],
    },
  });

  assert.equal(knowledgeResponse.statusCode, 200);

  const draftResponse = await app.inject({
    method: "POST",
    url: "/business/websites/draft",
    headers: businessOwnerHeaders,
    payload: {
      country: "KZ",
      companyName: "Nomdu Market",
      city: "Алматы",
      contact: "@nomdu_manager",
      style: "premium",
      siteType: "catalog",
      prompt:
        "Нужен сайт для Nomdu Market в Алматы. Продаем кофе, завтраки, доставку в офис и корпоративные наборы. Цена от 15 000 ₸. Контакт @nomdu_manager.",
    },
  });

  assert.equal(draftResponse.statusCode, 200);
  const draft = draftResponse.json();
  assert.equal(draft.job.status, "succeeded");
  assert.equal(draft.job.channel, "website");
  assert.equal(draft.website.status, "draft");
  assert.equal(draft.website.title, "Nomdu Market");
  assert.equal(draft.website.style, "premium");
  assert.equal(draft.website.content.pages[0].sections[0].type, "hero");
  assert.ok(draft.website.content.pages[0].sections.some((section: { type: string }) => section.type === "pricing"));
  assert.ok(draft.assistantSummary.includes("Nomdu Market"));

  const siteId = draft.website.id;
  const updatedContent = draft.website.content;
  updatedContent.pages[0].sections[0].title = "Nomdu Market — кофе и завтраки в Алматы";

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/business/websites/${siteId}`,
    headers: businessOwnerHeaders,
    payload: {
      title: "Nomdu Market",
      slug: "nomdu-market",
      content: updatedContent,
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().website.slug, "nomdu-market");
  assert.equal(updateResponse.json().website.content.pages[0].sections[0].title, "Nomdu Market — кофе и завтраки в Алматы");

  const publishResponse = await app.inject({
    method: "POST",
    url: `/business/websites/${siteId}/publish`,
    headers: businessOwnerHeaders,
    payload: {},
  });

  assert.equal(publishResponse.statusCode, 200);
  assert.equal(publishResponse.json().website.status, "published");
  assert.equal(publishResponse.json().website.publicationPath, "/site/nomdu-market");

  const publicResponse = await app.inject({
    method: "GET",
    url: "/public/websites/nomdu-market",
  });

  assert.equal(publicResponse.statusCode, 200);
  assert.equal(publicResponse.json().website.title, "Nomdu Market");
  assert.equal(publicResponse.json().website.status, "published");

  await app.close();
});

test("telegram bot order creates priced setup without exposing full bot token", async () => {
  const app = await createApp();
  const businessOwnerHeaders = { "x-nomduchat-local-role": "business_owner" };
  const botToken = "123456:VERY_SECRET_TELEGRAM_TOKEN";

  const response = await app.inject({
    method: "POST",
    url: "/telegram-bots/orders",
    headers: businessOwnerHeaders,
    payload: {
      country: "KZ",
      companyName: "Nomdu Market",
      ownerName: "Egor",
      contact: "@egor",
      businessDescription: "Маркетплейс и B2B-продажи столовых приборов для компаний.",
      services: "Каталог товаров, консультация, расчет партии, доставка и оптовые условия.",
      audience: "Владельцы кафе, ресторанов и закупщики компаний.",
      botPurpose: "Отвечать на вопросы, собирать заявку и передавать горячего клиента менеджеру.",
      tone: "sales",
      responseRules: "Не придумывать цены, если их нет в базе. Всегда уточнять город, объем и контакт.",
      escalationContact: "Передавать менеджеру @egor, если клиент просит индивидуальную цену.",
      faq: "Срок поставки зависит от партии. Для опта нужен расчет менеджера.",
      sourceLinks: "https://nomduchat.com",
      botUsername: "@nomdu_market_bot",
      botToken,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.order.currency, "KZT");
  assert.equal(body.order.amountMinor, 3_500_000);
  assert.equal(body.order.status, "ready_for_payment");
  assert.equal(body.order.botTokenProvided, true);
  assert.ok(body.order.setupSummary.includes("Nomdu Market"));
  assert.ok(body.order.systemPrompt.includes("Telegram-ассистент"));
  assert.equal(JSON.stringify(body).includes(botToken), false);

  const ordersResponse = await app.inject({
    method: "GET",
    url: "/telegram-bots/orders",
    headers: businessOwnerHeaders,
  });

  assert.equal(ordersResponse.statusCode, 200);
  assert.equal(ordersResponse.json().orders.length, 1);
  assert.equal(ordersResponse.json().orders[0].companyName, "Nomdu Market");

  const testReplyResponse = await app.inject({
    method: "POST",
    url: `/telegram-bots/orders/${body.order.id}/test-message`,
    headers: businessOwnerHeaders,
    payload: {
      message: "Здравствуйте, хочу оплатить и получить индивидуальную цену на большую партию.",
    },
  });

  assert.equal(testReplyResponse.statusCode, 200);
  assert.equal(testReplyResponse.json().shouldEscalate, true);
  assert.ok(testReplyResponse.json().reply.includes("@egor"));
  assert.equal(testReplyResponse.json().orderId, body.order.id);

  await app.close();
});

test("telegram mini app draft generates bot elements from a short business brief", async () => {
  const app = await createApp();
  const businessOwnerHeaders = { "x-nomduchat-local-role": "business_owner" };

  const response = await app.inject({
    method: "POST",
    url: "/telegram-bots/miniapp/draft",
    headers: businessOwnerHeaders,
    payload: {
      country: "RU",
      companyName: "Nomduchat B2B",
      businessCategory: "AI-агенты для малого бизнеса",
      city: "Москва",
      contact: "@nomduchat_manager",
      mainOffer: "Telegram-боты, которые отвечают клиентам, собирают заявки и передают диалог менеджеру.",
      priceInfo: "Запуск 7000 рублей. Токены оплачиваются отдельно.",
      goals: ["answers", "leads", "sales"],
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  const draft = body.draft;
  assert.equal(body.job.status, "succeeded");
  assert.equal(body.job.channel, "telegram");
  assert.equal(draft.currency, "RUB");
  assert.equal(draft.amountMinor, 700_000);
  assert.ok(draft.botUsernameSuggestions.length > 0);
  assert.ok(draft.menuButtons.includes("Оставить заявку"));
  assert.ok(draft.systemPrompt.includes("Telegram-ассистент"));
  assert.equal(draft.orderPayload.companyName, "Nomduchat B2B");
  assert.equal(draft.orderPayload.country, "RU");

  await app.close();
});

function parseSseEvents(payload: string) {
  return payload
    .trim()
    .split(/\r?\n\r?\n/)
    .map((rawEvent) => {
      const lines = rawEvent.split(/\r?\n/);
      const event = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim() ?? "";
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");

      return {
        event,
        data: JSON.parse(data),
      };
    });
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

class FakePasswordResetMailer implements PasswordResetMailer {
  lastEmail: PasswordResetMailInput | null = null;

  async sendPasswordReset(input: PasswordResetMailInput) {
    this.lastEmail = input;
  }
}

class FakeMailingTransport implements MailingTransport {
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
    return [];
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
