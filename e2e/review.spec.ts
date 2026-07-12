import { test, expect } from "@playwright/test";

// S-04 review session (FR-012). Covers plan manual checks 3.4/3.5/3.6 as a real
// browser flow: seed a due card → walk the due queue (reveal + rate advances) →
// drain to the "Session complete" state → reload and confirm rated cards are no
// longer due (reschedule persisted). Runs under the authenticated project
// (storageState from e2e/auth.setup.ts). Use a TEST account (never production).
//
// Determinism: the queue holds EVERY due card for the account, not just the seed,
// so the test drives the whole queue (rate every card "Good") rather than asserting
// a fixed count — correct whether the account is empty or already has due cards.

const uniqueFront = () => `E2E review ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;

test("review session walks the due queue and rated cards leave it after reload (S-04, FR-012)", async ({
  page,
}) => {
  const front = uniqueFront();
  const back = `answer for ${front}`;

  // Seed one due card through the real API (RLS-scoped by the session cookies).
  // A fresh card has review_state = null → immediately due.
  const seed = await page.request.post("/api/flashcards", { data: { cards: [{ front, back }] } });
  expect(seed.ok()).toBeTruthy();

  try {
    // 3.4 — the due queue renders and reveal + rate advances through it.
    await page.goto("/review");
    await expect(page.getByRole("button", { name: /show answer/i })).toBeVisible();

    // Drain the queue: reveal each card, then rate it "Good". Stops at the done state.
    for (let i = 0; i < 200; i++) {
      const showAnswer = page.getByRole("button", { name: /show answer/i });
      if (!(await showAnswer.isVisible().catch(() => false))) break;
      await showAnswer.click();
      const good = page.getByRole("button", { name: /^good$/i });
      await expect(good).toBeVisible();
      await good.click();
      // Wait for the state to change: either the next card's "Show answer" reappears
      // or the "Session complete" state renders.
      await expect(page.getByText(/show answer|session complete/i)).toBeVisible();
    }

    // 3.6 — draining the queue reaches the done state.
    await expect(page.getByText(/session complete/i)).toBeVisible();

    // 3.5 — the reschedule persisted: after reload, nothing is due (all rated cards
    // pushed into the future). This fails if a rating didn't persist across reload.
    await page.reload();
    await expect(page.getByText(/nothing due right now/i)).toBeVisible();
  } finally {
    // Cleanup (RLS-scoped): remove the seeded card via the deck UI's own delete path.
    await page.goto("/deck");
    const item = page.getByRole("listitem").filter({ hasText: front });
    if ((await item.count()) > 0) {
      page.once("dialog", (d) => void d.accept());
      await item.getByRole("button", { name: /delete/i }).click();
      await expect(item).toHaveCount(0);
    }
  }
});
