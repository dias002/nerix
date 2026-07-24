import { expect, test } from "@playwright/test";
import { prepareWorkspaceUser } from "./support";

test("avatar studio is available as a ready workspace feature", async ({ page }) => {
  await prepareWorkspaceUser(page, "user");

  await page.goto("/workspace/avatar");

  await expect(page.getByRole("heading", { name: "Аватар в вашем стиле" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Загрузить фото" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать" })).toBeDisabled();
});

test("forbidden hidden routes are redirected by feature gate", async ({ page }) => {
  await prepareWorkspaceUser(page, "user");

  await page.goto("/workspace/business");
  await expect(page).toHaveURL(/\/workspace\/chat$/);

  await page.goto("/workspace/admin");
  await expect(page).toHaveURL(/\/workspace\/chat$/);
});

test("business sections open from the lower briefcase palette", async ({ page }) => {
  await prepareWorkspaceUser(page, "business_owner");

  await page.goto("/workspace");

  const palette = page.getByRole("button", { name: "Бизнес-разделы" });
  await expect(palette).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Рабочие разделы" }).getByRole("link", { name: "Бизнес" })).toHaveCount(0);

  await palette.click();
  await expect(page.getByRole("link", { name: "Обзор" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI-сайт" })).toBeVisible();
});
