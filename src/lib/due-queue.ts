// Framework-free due-queue selection (S-04). `review.astro` fetches the deck and
// delegates here; keeping the filter out of the page frontmatter is what makes the
// "which cards are due" rule testable without rendering Astro.
import { isDue, type ReviewState } from "@/lib/srs";

export interface DeckRow {
  id: string;
  front: string;
  back: string;
  review_state: ReviewState | null;
}

export interface DueCard {
  id: string;
  front: string;
  back: string;
}

/**
 * The cards to review now: never-reviewed cards (null state) plus any whose next
 * due date has arrived. Returns only the presentational fields — `review_state`
 * must not reach the client island.
 */
export function selectDueCards(rows: readonly DeckRow[], now: Date): DueCard[] {
  return rows
    .filter((card) => card.review_state == null || isDue(card.review_state, now))
    .map(({ id, front, back }) => ({ id, front, back }));
}
