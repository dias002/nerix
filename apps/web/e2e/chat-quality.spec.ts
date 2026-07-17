import { expect, test } from "@playwright/test";
import { prepareWorkspaceUser } from "./support";

test("chat answer can be selected as best", async ({ page }) => {
  await prepareWorkspaceUser(page);

  await page.goto("/workspace/chat");
  await page.getByLabel("Модель ответа").selectOption({ label: "Local Mock" });
  await page.getByPlaceholder("Сообщение...").fill("Сделай короткий план для nomduchat");
  await page.keyboard.press("Enter");

  const bestAnswerButton = page.getByRole("button", { name: "Лучший ответ" });
  await expect(bestAnswerButton).toBeVisible();
  await bestAnswerButton.click();
  await expect(page.getByRole("button", { name: "Выбран" })).toBeVisible();
});
