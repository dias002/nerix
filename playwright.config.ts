import { defineConfig, devices } from "@playwright/test";

const useRunningServers = process.env.NERIX_E2E_RUNNING === "1";

export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useRunningServers
    ? undefined
    : [
        {
          command: "npm run api:dev",
          url: "http://127.0.0.1:4000/business/workspace",
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: "npm run web:dev",
          url: "http://127.0.0.1:5173/workspace/business",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
