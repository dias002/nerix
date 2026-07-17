import type { Page } from "@playwright/test";

const roleOverrideStorageKey = "nomduchat-local-role-override";
const cookieConsentStorageKey = "nomduchat-cookie-consent";
const countryConfirmedStorageKey = "nomduchat-country-confirmed";
const countryStorageKey = "nomduchat-country";
const appBuildStorageKey = "nomduchat-seen-app-build";
const appBuildId = "2026-07-07-visible-tasks";

export type E2eRole = "user" | "business_owner" | "business_employee" | "admin";

export async function prepareBase(page: Page) {
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
      window.localStorage.setItem("nomduchat-workspace-onboarding:v1:local-user", "dismissed");
      window.localStorage.setItem("nomduchat-workspace-onboarding:v1:local-business_owner", "dismissed");
      window.localStorage.setItem("nomduchat-workspace-onboarding:v1:local-business_employee", "dismissed");
      window.localStorage.setItem("nomduchat-workspace-onboarding:v1:local-admin", "dismissed");
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

export async function prepareWorkspaceUser(page: Page, role: E2eRole = "user") {
  await prepareBase(page);
  await page.addInitScript(
    ({ roleOverrideStorageKey: roleKey, roleValue }) => {
      window.localStorage.setItem(roleKey, roleValue);
    },
    { roleOverrideStorageKey, roleValue: role },
  );
}
