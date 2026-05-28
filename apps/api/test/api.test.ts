import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/server/create-app.js";

test("GET /health returns service status", async () => {
  const app = await createApp();

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    service: "nerix-api",
    version: "0.1.0",
  });

  await app.close();
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
      message: "Помоги написать структуру лендинга для Nerix",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.conversationId);
  assert.equal(body.userMessage.role, "user");
  assert.equal(body.assistantMessage.role, "assistant");
  assert.equal(body.route.agentId, "general");
  assert.ok(body.usage.estimatedCredits >= 30);

  await app.close();
});
