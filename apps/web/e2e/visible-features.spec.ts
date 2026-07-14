import { expect, test, type Page } from "@playwright/test";

const roleOverrideStorageKey = "nomduchat-local-role-override";
const cookieConsentStorageKey = "nomduchat-cookie-consent";
const countryConfirmedStorageKey = "nomduchat-country-confirmed";
const countryStorageKey = "nomduchat-country";
const appBuildStorageKey = "nomduchat-seen-app-build";
const appBuildId = "2026-07-07-visible-tasks";

async function prepareBase(page: Page) {
  await page.addInitScript(
    ({
      appBuildStorageKey: buildKey,
      appBuildId: buildId,
      cookieConsentStorageKey: consentKey,
      countryConfirmedStorageKey: countryConfirmedKey,
      countryStorageKey: countryKey,
    }) => {
      window.localStorage.setItem(
        consentKey,
        JSON.stringify({
          choice: "necessary",
          acceptedAt: new Date().toISOString(),
        }),
      );
      window.localStorage.setItem(countryKey, "KZ");
      window.localStorage.setItem(countryConfirmedKey, "true");
      window.localStorage.setItem(buildKey, buildId);
    },
    {
      appBuildStorageKey,
      appBuildId,
      cookieConsentStorageKey,
      countryConfirmedStorageKey,
      countryStorageKey,
    },
  );
}

async function prepareWorkspaceUser(page: Page, role = "user") {
  await prepareBase(page);
  await page.addInitScript(
    ({ roleOverrideStorageKey: roleKey, roleValue }) => {
      window.localStorage.setItem(roleKey, roleValue);
      window.localStorage.setItem("nomduchat-workspace-onboarding:v1:local-user", "dismissed");
      window.localStorage.setItem("nomduchat-workspace-onboarding:v1:local-business_owner", "dismissed");
    },
    { roleOverrideStorageKey, roleValue: role },
  );
}

test("public translation page opens an AI translation prompt in chat", async ({ page }) => {
  await prepareBase(page);
  await page.goto("/translate");
  await expect(page.getByRole("heading", { name: "Базовый и AI-перевод" })).toBeVisible();

  await page.getByPlaceholder("Введите текст для перевода").fill("Нужно подготовить описание проекта nomduchat");
  await page.getByLabel("Режим").selectOption("ai");
  await expect(page.getByText("Переведи текст на English.")).toBeVisible();

  await page.getByRole("button", { name: "Открыть в чате" }).click();
  await expect(page).toHaveURL(/\/workspace\/chat$/);
  await expect(page.getByPlaceholder("Сообщение...")).toContainText("Переведи текст на English");
});

test("public tool pages are usable and pass prompts to chat", async ({ page }) => {
  await prepareBase(page);
  await page.goto("/ai/flux-2");
  await expect(page.getByRole("heading", { name: "Flux 2 для визуальных идей" })).toBeVisible();
  await page.getByRole("button", { name: "Открыть в чате" }).click();
  await expect(page).toHaveURL(/\/workspace\/chat$/);
  await expect(page.getByPlaceholder("Сообщение...")).toContainText("Flux 2");

  await page.goto("/tools/dizajn-interyera");
  await expect(page.getByRole("heading", { name: "Нейросеть для интерьера" })).toBeVisible();
  await page.getByRole("button", { name: "гостиная" }).click();
  await expect(page.getByPlaceholder("Сообщение...")).toContainText("Тема: гостиная");

  await page.goto("/tools/humanizer");
  await expect(page.getByRole("heading", { name: "Очеловечивание текста" })).toBeVisible();
  await page.getByRole("button", { name: "Открыть в чате" }).click();
  await expect(page.getByPlaceholder("Сообщение...")).toContainText("Перепиши текст");
});

test("referral page leads a signed-in local user to profile settings", async ({ page }) => {
  await prepareWorkspaceUser(page);
  await page.goto("/about-referral-program");
  await expect(page.getByRole("heading", { name: "Приглашайте пользователей через личную ссылку" })).toBeVisible();

  await page.getByRole("link", { name: "Открыть профиль" }).click();
  await expect(page).toHaveURL(/\/workspace\/settings\/profile$/);
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Реферальная ссылка" })).toBeVisible();
});

test("workspace app and project aliases behave like real product routes", async ({ page }) => {
  await prepareWorkspaceUser(page);

  await page.goto("/chat/apps");
  await expect(page).toHaveURL(/\/workspace\/apps$/);
  await expect(page.getByRole("heading", { name: "Приложения" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Переводчик" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Генератор промптов" })).toBeVisible();

  await page.getByText("Очеловечь текст и убери AI-формулировки").click();
  await expect(page).toHaveURL(/\/workspace\/chat$/);
  await expect(page.getByPlaceholder("Сообщение...")).toContainText("Очеловечь текст");

  await page.goto("/chat/projects");
  await expect(page).toHaveURL(/\/workspace\/projects$/);
  await expect(page.getByRole("heading", { name: "Проекты" })).toBeVisible();

  await page.getByPlaceholder("Например, SEO-раздел").fill("Проверка таблицы");
  await page.getByPlaceholder("Что нужно сделать").fill("Закрыть пользовательские сценарии");
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("heading", { name: "Проверка таблицы" })).toBeVisible();

  await page.getByRole("button", { name: "Продолжить в чате" }).first().click();
  await expect(page).toHaveURL(/\/workspace\/chat$/);
  await expect(page.getByPlaceholder("Сообщение...")).toContainText("Помоги продолжить проект");
});

test("settings exposes token history and data deletion paths", async ({ page }) => {
  await prepareWorkspaceUser(page);
  await page.goto("/workspace/settings");

  await expect(page.getByRole("link", { name: /История токенов/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Удаление аккаунта и чатов/ })).toBeVisible();

  await page.getByRole("link", { name: /История токенов/ }).click();
  await expect(page).toHaveURL(/\/workspace\/balance#token-history$/);
  await expect(page.getByRole("heading", { name: "История токенов" })).toBeVisible();
});

test("registration avatar picker previews and clears a selected image", async ({ page }) => {
  await prepareBase(page);

  await page.goto("/auth?mode=register");
  await expect(page.getByRole("heading", { name: "Создать аккаунт" })).toBeVisible();
  await expect(page.getByText("Аватар профиля")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles("apps/web/public/favicon.png");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("nomduchat-registration-avatar"))).toContain("data:image");
  await expect(page.locator('img[alt=""]').first()).toBeVisible();

  await page.getByRole("button", { name: "Удалить аватар" }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("nomduchat-registration-avatar"))).toBeNull();
});

test("failed subscription renewal shows a modal and then a bottom nudge", async ({ page }) => {
  await prepareWorkspaceUser(page);
  await page.route("**/subscriptions/checkouts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        checkouts: [
          {
            id: "failed-renewal-e2e",
            userId: "local-user",
            planId: "base",
            country: "KZ",
            provider: "kaspi",
            currency: "KZT",
            amountMinor: 99000,
            status: "failed",
            creditsGranted: false,
            providerCheckoutId: "kaspi_failed_e2e",
            checkoutUrl: "https://pay.example.test/failed-renewal-e2e",
            customerEmail: "user@local.nomduchat",
            customerName: "Обычный пользователь",
            createdAt: "2026-07-14T00:00:00.000Z",
            updatedAt: "2026-07-14T00:05:00.000Z",
          },
        ],
      }),
    });
  });

  await page.goto("/workspace/chat");
  await expect(page.getByRole("heading", { name: "Не удалось продлить подписку" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Попробовать оплатить снова" })).toBeVisible();

  await page.getByLabel("Закрыть").click();
  await expect(page.getByText("Возобновите подписку")).toBeVisible();
  await page.getByRole("link", { name: "Возобновить" }).click();
  await expect(page).toHaveURL(/\/workspace\/balance$/);
});
