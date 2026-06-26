import { expect, test } from "@playwright/test";

test("Telegram Mini App builder generates a bot draft and creates an order", async ({ page }) => {
  await page.goto("/telegram/miniapp/bot-builder");

  await expect(page.getByRole("heading", { name: "AI bot builder" })).toBeVisible();
  await expect(page.getByText("Цена в конце")).toBeVisible();

  await page.getByLabel("Компания").fill("Nomdu Market");
  await page.getByLabel("Ниша").fill("Оптовые продажи посуды");
  await page.getByLabel("Город").fill("Алматы");
  await page.getByLabel("Контакт").fill("@egor");
  await page
    .getByLabel("Что продаете")
    .fill("Столовые приборы и товары для ресторанов, оптовый расчет, доставка и консультация менеджера.");
  await page.getByLabel("Цены и условия").fill("Стоимость зависит от партии. Запуск бота стоит 35000.");
  await page.getByLabel("Сайт или каталог").fill("https://nomduchat.com");

  await page.getByRole("button", { name: "Собрать элементы бота" }).click();

  await expect(page.getByText("Сгенерировано агентом")).toBeVisible();
  await expect(page.getByText("Nomdu Market assistant")).toBeVisible();
  await expect(page.getByText("@nomdu_market_bot")).toBeVisible();
  await expect(page.getByText("Приветствие")).toBeVisible();
  await expect(page.getByText("Оставить заявку")).toBeVisible();

  await page.getByRole("button", { name: "Создать заявку за 35 000" }).click();

  await expect(page.getByText(/Заявка создана: Nomdu Market/)).toBeVisible();
});
