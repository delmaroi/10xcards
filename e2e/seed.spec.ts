import { test, expect } from "@playwright/test";

// SEED TEST — the reference shape the /10x-e2e generator copies into every test.
// (Playwright's planner/generator uses the seed as the example for all generated tests.)
//
// Risk (context/foundation/test-plan.md → R3): an unauthenticated user reaches a
// protected product route. This is the ONE E2E-ready flow in 10xCards today — the
// gate is built (src/middleware.ts, default-deny). It exercises the full browser
// path: request → middleware → cookie check → redirect.
//
// Patterns demonstrated:
//  - ROLE-based selectors (getByRole) — survive CSS/DOM refactors; match the a11y
//    tree the agent sees in snapshots. Never CSS/XPath.
//  - Wait for STATE (waitForURL / toBeVisible), never waitForTimeout.
//  - Business-outcome assertion tied to the risk — this test FAILS if the gate lets
//    an unauthenticated user through.
//  - Test independence — no shared state; logged-out path needs no storageState.
//  - Risk-named test — the title maps to the risk, not "test 1".
//
// NOTE: exact accessible names (email textbox, sign-in button) must be validated
// against the live snapshot at generation time — that is the generator's job.
test("unauthenticated visitor is redirected from a protected route to sign-in (R3)", async ({ page }) => {
  // Hit a protected product route with no session.
  await page.goto("/dashboard");

  // Wait for the STATE (redirect), not an arbitrary timeout.
  await page.waitForURL("**/auth/signin");

  // Risk-bound assertions: the protected route is NOT reachable, and the sign-in
  // surface is shown. This fails if the gate regresses (dashboard renders logged-out).
  await expect(page).toHaveURL(/\/auth\/signin/);
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

// --- FUTURE, data-creating tests (once F-02 → S-01 → S-02 land) follow this shape:
//
//   test("created deck persists after page reload (R1/R4)", async ({ page }) => {
//     const deckName = `Test Deck ${Date.now()}`;   // UNIQUE id → parallel-safe, no collisions
//     await page.goto("/");
//     await page.getByRole("button", { name: "New deck" }).click();
//     await page.getByRole("textbox", { name: "Deck name" }).fill(deckName);
//     await page.getByRole("button", { name: "Create" }).click();
//     await expect(page.getByRole("heading", { name: deckName })).toBeVisible();
//     await page.reload();
//     await expect(page.getByRole("heading", { name: deckName })).toBeVisible(); // survives reload
//     await page.getByRole("button", { name: "Delete deck" }).click();          // CLEANUP
//     await page.getByRole("button", { name: "Confirm" }).click();
//   });
//
// Those run under the authenticated project (storageState) — see playwright.config.ts.
