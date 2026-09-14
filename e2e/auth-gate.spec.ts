import { test, expect } from "@playwright/test";

// R3 at the browser level, beyond the single route the seed test covers. The API
// half is the important one: it is the only layer where "302 vs 401" is observable
// the way a real client experiences it — fetch() follows the redirect silently, so
// a gate that redirects makes a rejected write look like a successful one.

const PROTECTED_PAGES = ["/dashboard", "/deck", "/generate", "/review", "/admin/metrics"];
const PUBLIC_PAGES = ["/", "/auth/signin", "/auth/signup", "/auth/confirm-email"];

test.describe("page gate", () => {
  for (const path of PROTECTED_PAGES) {
    test(`anonymous visitor is redirected from ${path} to sign-in (R3)`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL("**/auth/signin");
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    });
  }

  for (const path of PUBLIC_PAGES) {
    test(`anonymous visitor can reach ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(page.url()).not.toContain("/auth/signin?redirect");
    });
  }
});

test.describe("API gate answers 401, never a redirect to HTML", () => {
  const PROTECTED_API = [
    { method: "post" as const, path: "/api/flashcards", data: { cards: [{ front: "q", back: "a" }] } },
    { method: "post" as const, path: "/api/generate", data: { text: "x".repeat(50) } },
    { method: "post" as const, path: "/api/review/submit-rating", data: { id: "x", rating: 3 } },
    { method: "post" as const, path: "/api/metrics/generation", data: { generated: 1, accepted: 1, edited: 0 } },
  ];

  for (const endpoint of PROTECTED_API) {
    test(`${endpoint.path} rejects an anonymous caller with 401 JSON`, async ({ request }) => {
      const response = await request[endpoint.method](endpoint.path, {
        data: endpoint.data,
        maxRedirects: 0,
      });

      expect(response.status()).toBe(401);
      expect(response.headers()["content-type"]).toContain("application/json");
      expect(await response.json()).toEqual({ error: "unauthorized" });
    });
  }

  test("an anonymous write is never answered with the sign-in page", async ({ request }) => {
    // The exact regression: following the redirect yields 200 + HTML, and the
    // client reads that as a successful save.
    const response = await request.post("/api/flashcards", {
      data: { cards: [{ front: "q", back: "a" }] },
    });
    expect(response.status()).not.toBe(200);
    expect(await response.text()).not.toContain("<!DOCTYPE html>");
  });

  test("the public auth API stays reachable without a session", async ({ request, baseURL }) => {
    const response = await request.post("/api/auth/signin", {
      form: { email: "nobody@example.com", password: "wrong-password" },
      // Astro's CSRF check rejects a same-site POST with no Origin (403); a real
      // browser always sends one, so the test has to as well.
      headers: { Origin: baseURL ?? "" },
      maxRedirects: 0,
    });
    // Redirects back to the form with an error — not gated by the middleware.
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toContain("/auth/signin?error=");
  });
});
