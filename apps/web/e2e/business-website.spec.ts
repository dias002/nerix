import { expect, test } from "@playwright/test";

test("Business website builder opens a guided modal and generates a preview", async ({ page }) => {
  await page.goto("/workspace/business/website");

  await expect(page.getByRole("heading", { name: "Сайт, который клиент может править сам" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Клиент пишет, что ему нужно, а мы собираем первый сайт и показываем превью." })).toBeVisible();
  await page.getByRole("button", { name: "Создать сайт" }).first().click();

  const modal = page.locator("div.fixed").filter({ hasText: "Собрать сайт по короткому опросу" });
  await expect(page.getByRole("heading", { name: "Собрать сайт по короткому опросу" })).toBeVisible();
  await expect(modal.getByRole("heading", { name: "Что должен сказать сайт" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Дальше" })).toBeDisabled();

  await modal
    .getByLabel("Промпт про сайт")
    .fill(
      "Нужен сайт для Nomdu Coffee в Алматы. Продаем кофе, завтраки и доставку для офисов. Нужна заявка и контакт @nomdu_manager."
    );
  await expect(modal.getByRole("button", { name: "Дальше" })).toBeEnabled();
  await modal.getByRole("button", { name: "Дальше" }).click();

  await expect(modal.getByRole("heading", { name: "Куда вести заявку" })).toBeVisible();
  await modal.getByLabel("Название компании *").fill("Nomdu Coffee");
  await modal.getByLabel("Контакт на сайте *").fill("@nomdu_manager");
  await modal.getByLabel("Город").fill("Алматы");
  await modal.getByRole("button", { name: "Дальше" }).click();

  await expect(modal.getByRole("heading", { name: "Как сайт должен выглядеть" })).toBeVisible();
  await modal.getByRole("button", { name: "Каталог Товары или направления" }).click();
  await modal.getByRole("button", { name: "Премиум Темный, спокойный, дорогой" }).click();
  await modal.getByRole("button", { name: "Дальше" }).click();

  await expect(modal.getByRole("heading", { name: "Оплата запуска" })).toBeVisible();
  await modal.getByLabel("Номер карты").fill("4242 4242 4242 4242");
  await modal.getByLabel("Имя на карте").fill("NOMDU TEST");
  await modal.getByPlaceholder("MM/YY").fill("12/30");
  await modal.getByLabel("CVV").fill("123");
  await modal.getByLabel("Телефон для чека").fill("+77000000000");
  await modal.getByRole("button", { name: "Подтвердить и собрать сайт" }).click();

  await expect(modal.getByText("Сайт собран по вашему описанию").first()).toBeVisible();
  await expect(modal.getByText("Превью сайта")).toBeVisible();
  await expect(modal.getByRole("heading", { name: /Nomdu Coffee/ }).first()).toBeVisible();
});
