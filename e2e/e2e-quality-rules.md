# E2E test rules (10xCards)

Rules the agent must follow when generating browser-level tests. Source of the seed shape: `e2e/seed.spec.ts`. Framework: Playwright (adapt idioms if you switch to Cypress/WebdriverIO/Selenium).

## Prerequisites (run once, not done yet)

```bash
npm i -D @playwright/test
npx playwright install chromium
npm run test:e2e        # runs Playwright against a dev server (see playwright.config.ts webServer)
```

## Generation rules

1. **Locator hierarchy.** `getByRole` (with an accessible name) first; then `getByLabel`/`getByText`; **never** CSS/XPath (`page.locator('.btn')`, `nth-child`). Role selectors match what the agent sees in a11y snapshots and survive refactors.
2. **Wait for state, never for time.** Use `waitForURL`, `waitForResponse`, `expect(locator).toBeVisible()`. **Ban `page.waitForTimeout()`.**
3. **Test independence.** Each test does its own setup → action → assertion → cleanup. No test may depend on another (Playwright runs in parallel, random order).
4. **Business-outcome assertions.** Assert the observable result tied to a `test-plan.md` risk — not page titles, not internal calls. Control question: _would this assertion fail if the risk materialized?_ If no, it's naive.
5. **Data isolation.** Unique identifiers in created data (`` `Deck ${Date.now()}` ``) **and** cleanup (in-test or `afterEach`, with `afterAll` as a safety net). The suite must pass when run twice back-to-back.
6. **Auth via storageState.** Log in once (`e2e/auth.setup.ts`), reuse the saved session — don't log in per test. Logged-out tests (like the auth-gate seed) run without storageState.
7. **Mock only expensive/non-deterministic EXTERNAL boundaries** (LLM/OpenRouter, payment gateways) at the network layer. Keep internal boundaries real (auth, routing, DB) — that's where integration risk lives.

## Five anti-patterns to reject in REVIEW

1. **Naive assertion** — passes even if the risk materializes (e.g. asserting the page title instead of that data survived a reload). Re-prompt: name the observable business outcome the assertion must check.
2. **Brittle selector** — CSS/XPath/`nth-child`. Re-prompt: replace with `getByRole`.
3. **Shared state between tests** — test B assumes test A ran. Re-prompt: make each test self-contained.
4. **`waitForTimeout` instead of state** — flaky in CI. Re-prompt: wait for the concrete response/element.
5. **No cleanup** — second run hits unique-constraint/leftover-state failures. Re-prompt: add unique IDs + cleanup.

## VERIFY (green is not enough)

After the test is green, deliberately break the protected behavior in production code and confirm the test goes RED. If it stays green, the assertion protects nothing → back to GENERATE. Revert the break; never commit it.

## Supabase note

Cleanup/teardown clients must be authenticated as the account that created the data (RLS), or use the service-role key. Otherwise teardown sees empty tables despite existing rows.
