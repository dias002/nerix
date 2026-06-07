import { expect, test } from "@playwright/test";

test("business cabinet user flow", async ({ page }) => {
  const noteText = `Проверка e2e: клиент хочет бизнес-бота ${Date.now()}.`;

  await page.goto("/workspace/business");
  await expect(page.getByRole("heading", { name: "Бизнес-кабинет Nerix" })).toBeVisible();
  await expect(page.getByText("Business тариф: кабинет, роли, CRM и агент компании")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Команда и сотрудники" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Воронка продаж" })).toBeVisible();

  await page.getByRole("button", { name: "Пригласить" }).click();
  await expect(page.getByText(/Business уже заняты все 5 мест|Приглашение сотрудника будет отправлено/)).toBeVisible();

  const noteInput = page.getByPlaceholder("Добавьте проблему, договоренность или пометку по клиенту");
  await expect(noteInput).toBeVisible();
  if (await noteInput.isEnabled()) {
    await noteInput.fill(noteText);
    await page.getByRole("button", { name: "Добавить пометку" }).click();
    await expect(page.getByRole("button", { name: "Добавить пометку" })).toBeVisible();
    await expect(page.getByText(noteText).first()).toBeVisible();
  }

  await page.getByRole("link", { name: /Открыть идеи/ }).click();
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
  await expect(page.getByRole("heading", { name: "Бизнес-кабинет Nerix" })).toBeVisible();
});
