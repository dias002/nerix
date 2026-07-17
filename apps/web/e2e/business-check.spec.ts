import { expect, test } from "@playwright/test";
import { prepareWorkspaceUser } from "./support";

test("business cabinet user flow", async ({ page }) => {
  await prepareWorkspaceUser(page, "business_owner");
  await page.goto("/workspace/agents");
  await expect(page.getByRole("heading", { name: "Агенты" })).toBeVisible();
  await page.getByRole("link", { name: "Бизнес", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/business$/);
  await expect(page.getByRole("heading", { name: "Бизнес-разделы nomduchat" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Основные разделы теперь в левом меню" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI-сайт" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ИИ в Telegram" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Аналитика" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Идеи роста" })).toBeVisible();

  await page.getByRole("link", { name: "Аналитика" }).click();
  await expect(page).toHaveURL(/\/workspace\/business\/analytics$/);
  await expect(page.getByRole("heading", { name: "Аналитика сотрудников" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Отчеты сотрудников" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Команда" })).toBeVisible();
  await page.getByRole("button", { name: "Пригласить сотрудника" }).click();
  await expect(page.getByRole("heading", { name: "Новый сотрудник" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить сотрудника" })).toBeVisible();
  await page.getByRole("button", { name: "Отмена" }).click();

  await page.getByRole("link", { name: "ИИ в Telegram" }).click();
  await expect(page).toHaveURL(/\/workspace\/business\/telegram-bot$/);
  await expect(page.getByRole("heading", { name: "Запуск Telegram-менеджера с готовыми правилами ответа" })).toBeVisible();
  await page.getByRole("button", { name: "Оформить заявку на Telegram-менеджера" }).click();
  await expect(page.getByRole("heading", { name: "Кто запускает менеджера" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Дальше" })).toBeDisabled();
  await page.getByPlaceholder("@username, телефон или WhatsApp").fill("@nomdu_manager");
  await page.getByPlaceholder("Например, Nomdu Coffee").fill("Nomdu Coffee");
  await expect(page.getByRole("button", { name: "Дальше" })).toBeEnabled();

  await page.goto("/workspace/business");
  await page.getByRole("link", { name: "Идеи роста" }).click();
  await expect(page).toHaveURL(/\/workspace\/business\/ideas$/);
  await expect(page.getByRole("heading", { name: "Идеи и подсказки для бизнеса" })).toBeVisible();
  const salesTab = page.getByRole("button", { name: "Продажи Как быстрее доводить до оплаты" });
  if ((await salesTab.count()) > 0) {
    await salesTab.click();
    const salesIdea = page.locator("article").filter({ hasText: "Собрать короткий скрипт" }).first();
    const salesIdeaAction = salesIdea.getByRole("button").first();
    await expect(salesIdeaAction).toBeVisible();
    if ((await salesIdeaAction.textContent())?.includes("Взять в работу")) {
      await salesIdeaAction.click();
    }
    await expect(salesIdea.getByRole("button", { name: "В плане" })).toBeVisible();
  } else {
    await expect(page.getByText("Идеи появятся после загрузки данных бизнес-кабинета.")).toBeVisible();
  }

  await page.getByRole("link", { name: /Назад в бизнес-кабинет/ }).click();
  await expect(page).toHaveURL(/\/workspace\/business$/);
  await expect(page.getByRole("heading", { name: "Бизнес-разделы nomduchat" })).toBeVisible();
});
