// SRS scheduler helper (S-04). The one place the app touches ts-fsrs — every other
// module goes through these three functions, so the FSRS library never leaks into
// endpoints, pages, or islands. Contract source: F-03 spike
// (context/changes/srs-library-spike/research.md).

import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";

// Ratings the UI offers, in display order. Manual/0 is intentionally excluded.
export { Rating };
export type ReviewRating = Grade;
export type ReviewState = Card;

// One scheduler instance with default FSRS params (MVP — per-user optimization is
// out of scope; see plan Open Questions).
const scheduler = fsrs();

/** A fresh review state for a card that has never been reviewed. */
export function emptyReviewState(now: Date): ReviewState {
  return createEmptyCard(now);
}

/**
 * Reschedule a card from a rating. `state` may arrive with its date fields as ISO
 * strings (jsonb round-trip) — ts-fsrs `next()` revives them and returns a Card whose
 * `due`/`last_review` are real Dates, so the persisted JSON stays consistent.
 */
export function applyRating(state: ReviewState, rating: ReviewRating, now: Date): ReviewState {
  return scheduler.next(state, now, rating).card;
}

/**
 * Is this card due at `now`? `state.due` may be a Date (fresh) or an ISO string
 * (loaded from jsonb); coerce before comparing — a raw string `<=` Date silently
 * yields false.
 */
export function isDue(state: ReviewState, now: Date): boolean {
  return new Date(state.due) <= now;
}
