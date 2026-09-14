import { describe, it, expect } from "vitest";
import { selectDueCards, type DeckRow } from "@/lib/due-queue";
import { emptyReviewState, applyRating, Rating } from "@/lib/srs";

// Extracted from review.astro so the "what is due" rule is testable. Two contracts:
// (1) a never-reviewed card is due, (2) review_state never reaches the client.

const NOW = new Date("2026-07-12T00:00:00Z");

const row = (id: string, review_state: DeckRow["review_state"]): DeckRow => ({
  id,
  front: `front ${id}`,
  back: `back ${id}`,
  review_state,
});

describe("selectDueCards (S-04 due queue)", () => {
  it("treats a never-reviewed card (null state) as due", () => {
    expect(selectDueCards([row("a", null)], NOW).map((c) => c.id)).toEqual(["a"]);
  });

  it("excludes a card rescheduled into the future", () => {
    const rated = applyRating(emptyReviewState(NOW), Rating.Easy, NOW);
    expect(selectDueCards([row("a", rated)], NOW)).toEqual([]);
  });

  it("includes a card whose due date has passed", () => {
    const rated = applyRating(emptyReviewState(NOW), Rating.Easy, NOW);
    const muchLater = new Date(new Date(rated.due).getTime() + 86_400_000);
    expect(selectDueCards([row("a", rated)], muchLater).map((c) => c.id)).toEqual(["a"]);
  });

  it("strips review_state — the island must only receive id/front/back", () => {
    const [card] = selectDueCards([row("a", null)], NOW);
    expect(Object.keys(card).sort()).toEqual(["back", "front", "id"]);
  });

  it("preserves input order for the cards it keeps", () => {
    const future = applyRating(emptyReviewState(NOW), Rating.Easy, NOW);
    const rows = [row("a", null), row("b", future), row("c", null)];
    expect(selectDueCards(rows, NOW).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("returns an empty queue for an empty deck", () => {
    expect(selectDueCards([], NOW)).toEqual([]);
  });

  it("handles a jsonb round-tripped state (dates arrive as strings)", () => {
    const rated = applyRating(emptyReviewState(NOW), Rating.Easy, NOW);
    const stored = JSON.parse(JSON.stringify(rated)) as DeckRow["review_state"];
    expect(selectDueCards([row("a", stored)], NOW)).toEqual([]);
  });
});
