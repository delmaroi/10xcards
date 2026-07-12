import { describe, it, expect, vi } from "vitest";
import { handleSubmitRating } from "@/lib/review-rating";
import { emptyReviewState, type ReviewState } from "@/lib/srs";

const NOW = new Date("2026-07-12T00:00:00Z");
const okSave = () => vi.fn<(id: string, s: ReviewState) => Promise<{ ok: boolean }>>().mockResolvedValue({ ok: true });
const foundCard = (state: ReviewState | null) => vi.fn().mockResolvedValue({ found: true, state });

describe("handleSubmitRating (S-04 review rating)", () => {
  it("returns 401 when there is no user", async () => {
    const saveState = okSave();
    const r = await handleSubmitRating({
      userId: null,
      body: { id: "c1", rating: 3 },
      now: NOW,
      loadCard: foundCard(null),
      saveState,
    });
    expect(r.status).toBe(401);
    expect(saveState).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed body / out-of-range rating", async () => {
    const r = await handleSubmitRating({
      userId: "u1",
      body: { id: "c1", rating: 5 },
      now: NOW,
      loadCard: foundCard(null),
      saveState: okSave(),
    });
    expect(r.status).toBe(400);
  });

  it("returns 404 when the card is not found (RLS / bad id)", async () => {
    const saveState = okSave();
    const r = await handleSubmitRating({
      userId: "u1",
      body: { id: "not-mine", rating: 3 },
      now: NOW,
      loadCard: vi.fn().mockResolvedValue({ found: false, state: null }),
      saveState,
    });
    expect(r.status).toBe(404);
    expect(saveState).not.toHaveBeenCalled();
  });

  it("lazy-inits review_state when null and persists a future due", async () => {
    const saveState = okSave();
    const r = await handleSubmitRating({
      userId: "u1",
      body: { id: "c1", rating: 3 },
      now: NOW,
      loadCard: foundCard(null),
      saveState,
    });
    expect(r.status).toBe(200);
    expect(r.body.reps as number).toBe(1);
    expect(new Date(r.body.due as string).getTime()).toBeGreaterThan(NOW.getTime());
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it("reschedules an existing review_state", async () => {
    const existing = emptyReviewState(NOW);
    const r = await handleSubmitRating({
      userId: "u1",
      body: { id: "c1", rating: 4 },
      now: NOW,
      loadCard: foundCard(existing),
      saveState: okSave(),
    });
    expect(r.status).toBe(200);
    expect(r.body.reps as number).toBe(1);
  });

  it("returns 500 when the save fails", async () => {
    const r = await handleSubmitRating({
      userId: "u1",
      body: { id: "c1", rating: 3 },
      now: NOW,
      loadCard: foundCard(null),
      saveState: vi.fn().mockResolvedValue({ ok: false }),
    });
    expect(r.status).toBe(500);
  });
});
