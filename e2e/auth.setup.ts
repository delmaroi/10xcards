import { test as setup, expect } from "@playwright/test";

// storageState bootstrap: log in ONCE, save the session, and let authenticated
// tests reuse it (config's `chromium` project) instead of logging in per test.
// Enable the setup + chromium projects in playwright.config.ts when login-gated
// features exist. Use a TEST account only (never production); prefer env vars.
const authFile = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/auth/signin");
  await page.getByRole("textbox", { name: /email/i }).fill(process.env.E2E_EMAIL ?? "");
  await page.getByRole("textbox", { name: /password/i }).fill(process.env.E2E_PASSWORD ?? "");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for the post-login STATE, not a timeout.
  await page.waitForURL("**/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authFile });
});
