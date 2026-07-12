import { z } from "zod";
import { emptyReviewState, applyRating, type ReviewState } from "@/lib/srs";

// Framework-free handler for submitting a review rating (S-04). No astro:* imports →
// unit-testable. DB ops are injected. Ownership is enforced by the caller's RLS: a
// card the user doesn't own is never loaded, so it maps to 404 — never a cross-user write.

export interface RatingResponse {
  status: number;
  body: Record<string, unknown>;
}

// Ratings the UI offers: Again=1, Hard=2, Good=3, Easy=4 (ts-fsrs Grade; Manual/0 excluded).
const ratingSchema = z.object({
  id: z.string().min(1),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export async function handleSubmitRating(input: {
  userId: string | null;
  body: unknown;
  now: Date;
  loadCard: (id: string) => Promise<{ found: boolean; state: ReviewState | null }>;
  saveState: (id: string, state: ReviewState) => Promise<{ ok: boolean }>;
}): Promise<RatingResponse> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };

  const parsed = ratingSchema.safeParse(input.body);
  if (!parsed.success) return { status: 400, body: { error: "invalid_request" } };

  const { found, state } = await input.loadCard(parsed.data.id);
  if (!found) return { status: 404, body: { error: "not_found" } };

  // Lazy-init: a card reviewed for the first time has no review_state yet.
  const current = state ?? emptyReviewState(input.now);
  const next = applyRating(current, parsed.data.rating, input.now);

  const { ok } = await input.saveState(parsed.data.id, next);
  if (!ok) return { status: 500, body: { error: "save_failed" } };

  return { status: 200, body: { due: next.due, reps: next.reps } };
}
