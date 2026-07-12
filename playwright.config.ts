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
    // Logged-out tests (e.g. the auth-gate seed) — need no session.
    { name: "logged-out", use: { ...devices["Desktop Chrome"] } },

    // Authenticated tests — reuse a saved session (storageState). ENABLE once
    // features that require login exist (deck/generation, i.e. F-02 → S-01 → S-02).
    // Requires e2e/auth.setup.ts filled with a TEST account's credentials.
    // { name: "setup", testMatch: /auth\.setup\.ts/ },
    // {
    //   name: "chromium",
    //   use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
    //   dependencies: ["setup"],
    //   testIgnore: /auth\.setup\.ts/,
    // },
  ],
});
