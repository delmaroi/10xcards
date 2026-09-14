import type { Page } from "@playwright/test";

/**
 * Wait for every Astro island on the page to hydrate.
 *
 * `client:load` islands render server-side first and only become interactive once
 * their JS runs. Playwright is fast enough to click the SSR markup before that
 * happens — the click then submits the form natively, skipping the React
 * validation entirely, and the test fails for a reason that has nothing to do with
 * the behaviour under test. Astro marks a pending island with an `ssr` attribute
 * and removes it after hydrating, which is the signal used here.
 */
export async function waitForIslands(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll("astro-island[ssr]").length === 0);
}
