import { test, expect } from "@playwright/test";

// S-03 deck management as a real browser flow: seed through the API, edit inline,
// prove the edit SURVIVED A RELOAD (an optimistic UI update that was never
// persisted looks identical until you reload), then delete and prove it is gone.
// Runs under the authenticated project (storageState from e2e/auth.setup.ts).

const unique = () => `E2E deck ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;

async function seedCard(request: import("@playwright/test").APIRequestContext, front: string, back: string) {
  const response = await request.post("/api/flashcards", { data: { cards: [{ front, back }] } });
  expect(response.ok()).toBeTruthy();
}

test("an inline edit persists across a reload (S-03)", async ({ page }) => {
  const front = unique();
  const edited = `${front} edited`;
  await seedCard(page.request, front, "original answer");

  try {
    await page.goto("/deck");
    const row = page.getByRole("listitem").filter({ hasText: front });
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Question").fill(edited);
    await row.getByLabel("Answer").fill("revised answer");
    await row.getByRole("button", { name: "Save" }).click();

    // Optimistic update…
    await expect(page.getByText(edited)).toBeVisible();

    // …that must still be there after a round trip to the database.
    await page.reload();
    await expect(page.getByText(edited)).toBeVisible();
    await expect(page.getByText("revised answer")).toBeVisible();
  } finally {
    await page.goto("/deck");
    const row = page.getByRole("listitem").filter({ hasText: front });
    if ((await row.count()) > 0) {
      page.once("dialog", (dialog) => void dialog.accept());
      await row.getByRole("button", { name: "Delete" }).click();
      await expect(row).toHaveCount(0);
    }
  }
});

test("a deleted card does not come back after a reload (S-03)", async ({ page }) => {
  const front = unique();
  await seedCard(page.request, front, "answer");

  await page.goto("/deck");
  const row = page.getByRole("listitem").filter({ hasText: front });
  await expect(row).toHaveCount(1);

  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: front })).toHaveCount(0);
});

test("cancelling the confirmation keeps the card (S-03)", async ({ page }) => {
  const front = unique();
  await seedCard(page.request, front, "answer");

  try {
    await page.goto("/deck");
    const row = page.getByRole("listitem").filter({ hasText: front });

    page.once("dialog", (dialog) => void dialog.dismiss());
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveCount(1);

    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: front })).toHaveCount(1);
  } finally {
    await page.goto("/deck");
    const row = page.getByRole("listitem").filter({ hasText: front });
    if ((await row.count()) > 0) {
      page.once("dialog", (dialog) => void dialog.accept());
      await row.getByRole("button", { name: "Delete" }).click();
      await expect(row).toHaveCount(0);
    }
  }
});
