// Shared domain types (entities, DTOs). Per-project convention: entities live here.

/** A saved flashcard belonging to a single user (F-02). Mirrors `public.flashcards`. */
export interface Flashcard {
  id: string;
  user_id: string;
  front: string;
  back: string;
  source: "ai" | "manual";
  /**
   * SRS review state — the ts-fsrs `Card` object, stored as JSON. Lazy-initialized
   * on a card's first review (S-04); `null` until then. Typed loosely here until
   * S-04 imports the ts-fsrs `Card` type.
   */
  review_state: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fields the app supplies when creating a flashcard. `user_id` is derived from the
 * session (never client-supplied), `id`/timestamps come from DB defaults, and
 * `source` defaults to `'ai'` in the schema so callers may omit it.
 */
export type FlashcardInput = Pick<Flashcard, "front" | "back"> & {
  source?: Flashcard["source"];
};

/**
 * One saved generation-triage batch (S-04, FR-004). Feeds the AI acceptance-rate
 * metric (Σaccepted / Σgenerated). `edited` = accepted proposals the user changed
 * before saving. Owner-scoped; mirrors `public.generation_stats`.
 */
export interface GenerationStat {
  id: string;
  user_id: string;
  generated: number;
  accepted: number;
  edited: number;
  created_at: string;
}

/** Counts the client reports after a triage-commit; `user_id` derived from the session. */
export type GenerationStatInput = Pick<GenerationStat, "generated" | "accepted" | "edited">;
