import { expect, test } from "@playwright/test";

test("admin panel shows memory aggregates and editable pricing", async ({ page }) => {
  await page.goto("/workspace");

  await page.getByLabel("Локальная роль").click();
  await page.getByRole("option", { name: "Админ", exact: true }).click();
  await page.getByRole("link", { name: "Админ", exact: true }).click();

  await expect(page).toHaveURL(/\/workspace\/admin/);
  await expect(page.getByRole("heading", { name: "Панель управления Nerix" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Направление" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Приоритеты админа" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Отчет по оплатам" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kaspi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "YooKassa" })).toBeVisible();

  await page.getByRole("link", { name: "Пользователи", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/admin\?tab=users/);
  await expect(page.getByRole("heading", { name: "Пользователи" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Поиск пользователей" })).toBeVisible();
  await expect(page.getByText("Реальные пользователи загрузятся из API")).toHaveCount(0);

  await page.getByRole("link", { name: "Память", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/admin\?tab=memory/);
  await expect(page.getByRole("heading", { name: "Память и чаты в базе" })).toBeVisible();
  await expect(page.getByText("Чатов в базе")).toBeVisible();
  await expect(page.getByText("Содержимое не раскрывается")).toBeVisible();
  await expect(page.getByText("Содержимое чатов и сообщений не выводится.")).toBeVisible();

  await page.getByRole("link", { name: "Прайс", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/admin\?tab=pricing/);
  const ratesLoaded = await page.getByText("USD/RUB", { exact: true }).count();
  if (ratesLoaded > 0) {
    await expect(page.getByText("USD/KZT", { exact: true })).toBeVisible();
    await expect(page.getByText("RUB/KZT", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText("Реальные курсы валют пока не загрузились")).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Прайс тарифов" })).toBeVisible();
  await expect(page.getByText(/20\s*млн/i)).toHaveCount(0);

  const priceInputs = page.locator('input[inputmode="decimal"]');
  if ((await priceInputs.count()) > 0) {
    await priceInputs.first().fill("6990");
    await page.getByLabel("Сохранить цену").first().click();
    await expect(page.getByText("Прайс обновлен.")).toBeVisible();
  } else {
    await expect(page.getByText("Локальные константы вместо них не показываются.")).toBeVisible();
  }
});
