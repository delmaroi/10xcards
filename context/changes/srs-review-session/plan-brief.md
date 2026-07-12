# SRS Review Session (S-04) — Plan Brief

> Full plan: `context/changes/srs-review-session/plan.md`
> Research: `context/changes/srs-review-session/research.md`
> Library spike: `context/changes/srs-library-spike/research.md`

## What & Why

Give the deck a purpose: a spaced-repetition review session where the user rates each due card and FSRS reschedules it. Roadmap slice S-04 (PRD US-01, FR-012) — without it, a deck of cards is just a nicer notepad.

## Starting Point

10xCards is auth + UI scaffolding only (research, commit d34459a). Auth/session and default-deny gating are solid and reusable; there is **no flashcard table, no persistence, no SRS dependency** yet. S-04 rides on a `flashcard` table that F-02 must create and S-02 must populate.

## Desired End State

A logged-in user opens `/review`, goes through all cards due today (reveal answer → rate Again/Hard/Good/Easy), and each rating updates and persists the card's FSRS `review_state`; the session ends when the queue empties. Cards without state are lazily initialized on first review.

## Key Decisions Made

| Decision             | Choice                                                   | Why (1 sentence)                                                              | Source       |
| -------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------ |
| Algorithm + library  | FSRS via `ts-fsrs` (5.x)                                 | Maintained first-party TS FSRS; ~20–30% fewer reviews than SM-2; Anki default | Spike (F-03) |
| ReviewState shape    | `ts-fsrs` `Card` object as JSON in `review_state` column | Store what the scheduler returns; no lossy mapping                            | Spike (F-03) |
| Rating scale         | 4 buttons: Again/Hard/Good/Easy                          | FSRS's grade scale                                                            | Spike (F-03) |
| Due selection        | `review_state` null OR `due <= now`                      | Simple, index-friendly predicate                                              | Research     |
| State init ownership | S-04 lazy-inits via `createEmptyCard()` on first review  | Keeps S-04 self-sufficient; robust to cards created before S-04               | Plan         |
| Session scope        | Full due-queue session on `/review`                      | Real "review session" per FR-012, not a single card                           | Plan         |

## Scope

**In scope:** `ts-fsrs` dep; `review_state jsonb` column; `src/lib/srs.ts` helper; `/api/review/submit-rating` endpoint; `/review` page + `ReviewSession` island (due queue).

**Out of scope:** F-02 table + RLS, S-01/S-02 (generation/save), card edit/delete (S-03), per-user optimized params, metrics dashboard.

## Architecture / Approach

Three vertical phases on the assumed `flashcard` table: data + scheduler helper → rating API (lazy-init + `scheduler.next`) → `/review` page with a React island walking the queue. `/review` is auto-gated by existing middleware. All FSRS access funnels through `src/lib/srs.ts`.

## Phases at a Glance

| Phase               | What it delivers                                         | Key risk                                                        |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Data & scheduler | `ts-fsrs` dep + `review_state` column + `src/lib/srs.ts` | Migration depends on F-02's table existing                      |
| 2. Rating API       | `/api/review/submit-rating` (lazy-init + reschedule)     | RLS must scope card access to the user                          |
| 3. Review page      | `/review` + `ReviewSession` island (due queue)           | "today" boundary/timezone (open question) affects the due query |

**Prerequisites:** F-02 (flashcard table + RLS) and S-02 (save-to-deck) must exist. **S-04 is blocked until then.** F-03 spike is done (library chosen).
**Estimated effort:** ~1–2 sessions across 3 phases once prerequisites land.

## Open Risks & Assumptions

- **Blocked on F-02 + S-02** — the whole slice assumes a per-user `flashcard` table. Do not start Phase 1 before then.
- Assumes default `fsrs()` params for MVP.
- Open: edit-vs-reset policy, model params, "today"/timezone boundary — left explicit, not guessed.

## Success Criteria (Summary)

- Due cards appear at `/review` in sequence; rating each reschedules and persists its `review_state`.
- Rated cards leave today's queue; empty queue shows a done state.
- Cross-user isolation holds (RLS); logged-out `/review` redirects to sign-in.
