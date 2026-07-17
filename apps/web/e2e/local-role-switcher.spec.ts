import { expect, test } from "@playwright/test";
import { prepareBase } from "./support";

test("local role switcher changes workspace navigation", async ({ page }) => {
  await prepareBase(page);
  await page.goto("/workspace");

  const chooseRole = async (name: string) => {
    await page.getByLabel("Локальная роль").click();
    await page.getByRole("option", { name, exact: true }).click();
  };

  await expect(page.getByLabel("Локальная роль")).toBeVisible();

  await chooseRole("Админ");
  await expect(page.getByRole("link", { name: "Админ", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Пользователи", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Запуск", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI бюджет", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Прайс", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Рассылки", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Главная", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Чат", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "История", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Агенты", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Бизнес", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Баланс", exact: true })).toHaveCount(0);

  await chooseRole("Обычный пользователь");
  await expect(page.getByRole("link", { name: "Админ", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Пользователи", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Прайс", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Рассылки", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Бизнес", exact: true })).toHaveCount(0);

  await chooseRole("Сотрудник");
  await expect(page.getByRole("link", { name: "Бизнес", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Админ", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Рассылки", exact: true })).toHaveCount(0);
});
