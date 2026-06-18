import { expect, test } from "@playwright/test";

test("chat answer can be selected as best", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("nomduchat-guest-chat-requests", "1");
  });

  await page.goto("/workspace/chat");
  await page.getByPlaceholder("Сообщение...").fill("Сделай короткий план для nomduchat");
  await page.keyboard.press("Enter");

  const bestAnswerButton = page.getByRole("button", { name: "Лучший ответ" });
  await expect(bestAnswerButton).toBeVisible();
  await bestAnswerButton.click();
  await expect(page.getByRole("button", { name: "Выбран" })).toBeVisible();
});
