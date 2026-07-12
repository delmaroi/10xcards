import { describe, it, expect } from "vitest";
import { emptyReviewState, applyRating, isDue, Rating, type ReviewState } from "@/lib/srs";

const roundtrip = (s: ReviewState): ReviewState => JSON.parse(JSON.stringify(s)) as ReviewState;

const NOW = new Date("2026-07-12T00:00:00Z");

describe("srs helper (S-04 FSRS wrapper)", () => {
  it("emptyReviewState returns a fresh, immediately-due card", () => {
    const state = emptyReviewState(NOW);
    expect(state.reps).toBe(0);
    expect(state.stability).toBeGreaterThanOrEqual(0);
    expect(isDue(state, NOW)).toBe(true);
  });

  it("applyRating increments reps and pushes due into the future", () => {
    const next = applyRating(emptyReviewState(NOW), Rating.Good, NOW);
    expect(next.reps).toBe(1);
    expect(new Date(next.due).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("applyRating works on a jsonb round-tripped state (string dates)", () => {
    const stored = roundtrip(emptyReviewState(NOW));
    const next = applyRating(stored, Rating.Again, NOW);
    expect(next.due).toBeInstanceOf(Date);
    expect(next.reps).toBe(1);
  });

  it("isDue coerces string dates from storage before comparing", () => {
    const future = applyRating(emptyReviewState(NOW), Rating.Easy, NOW);
    const stored = roundtrip(future); // due is now an ISO string
    expect(isDue(stored, NOW)).toBe(false);
    expect(isDue(stored, new Date(new Date(future.due).getTime() + 1000))).toBe(true);
  });
});
