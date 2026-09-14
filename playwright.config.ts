import { defineConfig, devices } from "@playwright/test";

// E2E config. Prereqs: `npm i -D @playwright/test && npx playwright install chromium`.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.AI_AGENT ? "dot" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // Boots the Astro dev server for the run; reuses one already running locally.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    // Logged-out tests — need no session, so they run anywhere (CI included).
    {
      name: "logged-out",
      testMatch: /(seed|auth-gate|auth-forms)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Authenticated tests — reuse a saved session (storageState). Enabled with
    // F-02 → S-04 shipped. Requires a TEST account via E2E_EMAIL / E2E_PASSWORD
    // (see e2e/auth.setup.ts); never production credentials.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testMatch: /(review|deck)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
