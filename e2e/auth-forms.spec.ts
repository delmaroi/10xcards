import { test, expect } from "@playwright/test";
import { waitForIslands } from "./helpers";

// Client-side validation on the two public auth forms. The contract is that an
// invalid form never reaches the server: the user stays put, sees a field-level
// message, and no navigation happens.

test.describe("sign-in form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signin");
    await waitForIslands(page);
  });

  test("blocks an empty submission and flags both fields", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signin$/);
  });

  test("rejects a malformed email address", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email" }).fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("secret");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("clears the message once the field is corrected", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Email is required")).toBeVisible();
    await page.getByRole("textbox", { name: "Email" }).fill("a@b.com");
    await expect(page.getByText("Email is required")).toBeHidden();
  });

  test("reveals the password on demand", async ({ page }) => {
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });

  test("returns to the form with a server error for wrong credentials", async ({ page }) => {
    // Deliberately provider-agnostic: with Supabase configured this is "Invalid
    // login credentials", without it "Supabase is not configured". Either way the
    // user must land back on the form WITH an explanation, and never signed in.
    await page.getByRole("textbox", { name: "Email" }).fill("nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/auth\/signin\?error=/);
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("offers Google sign-in through the server-side OAuth init", async ({ page }) => {
    // Assert the target rather than following it — the flow leaves our origin.
    await expect(page.getByRole("link", { name: /continue with google/i })).toHaveAttribute(
      "href",
      "/api/auth/google",
    );
  });
});

test.describe("sign-up form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signup");
    await waitForIslands(page);
  });

  test("blocks an empty submission and flags all three fields", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page.getByText("Please confirm your password")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signup$/);
  });

  test("blocks a password below the minimum length", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email" }).fill("new@example.com");
    await page.getByLabel("Password", { exact: true }).fill("abc");
    await page.getByLabel("Confirm password").fill("abc");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Password must be at least 6 characters")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signup$/);
  });

  test("blocks a mismatched confirmation", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email" }).fill("new@example.com");
    await page.getByLabel("Password", { exact: true }).fill("secret1");
    await page.getByLabel("Confirm password").fill("secret2");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/signup$/);
  });

  test("counts down the characters still needed", async ({ page }) => {
    await page.getByLabel("Password", { exact: true }).fill("abcde");
    await expect(page.getByText("1 more character needed")).toBeVisible();
  });
});
