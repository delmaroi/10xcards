# SRS Review Session (S-04) Implementation Plan

## Overview

Add a spaced-repetition review session: the user opens `/review`, sees each card due today, rates it (Again / Hard / Good / Easy), and the card's review state is rescheduled via FSRS. This is roadmap slice S-04 (PRD US-01, FR-012). Algorithm/library and data-shape decisions are settled by the F-03 spike (`context/changes/srs-library-spike/research.md`) → **FSRS via `ts-fsrs`**.

## Current State Analysis

Grounded in `context/changes/srs-review-session/research.md` (commit d34459a):

- **Data layer is absent** — no flashcard/deck table, no migrations, no `src/types.ts`. S-04 rides on a `flashcard` table that **F-02 must create** and **S-02 must populate**.
- **Auth/gating is present and reusable** — `src/middleware.ts:19-46` sets `context.locals.user` and default-deny-gates every non-public route, so `/review` and `/api/review/*` are auto-protected with no extra work.
- **Conventions to follow**: server Supabase client via `createClient(...)` (`src/lib/supabase.ts:5-24`); API endpoints as `export const POST: APIRoute` reading the user from `context.locals.user` (`src/pages/api/auth/signin.ts:4-20`); `@/*` imports; secrets via `astro:env/server`.
- **Stack compatible** with `ts-fsrs` (Node ≥20; repo runs 22.14.0).

## Desired End State

A logged-in user with saved cards can open `/review`, go through all cards due today one by one (reveal answer → pick one of four ratings), and on each rating the card's `review_state` is updated by FSRS and persisted; the session ends when the queue is empty. A card with no `review_state` yet is lazily initialized on its first review.

Verify: seed a user's deck with cards (via F-02/S-02); some due now. Open `/review` → due cards appear in sequence; rating a card persists a new `review_state` with a future `due`; the card leaves today's queue; empty queue shows a "done" state; another user never sees these cards (RLS isolation).

### Key Discoveries:

- Contract (from F-03 spike): store the `ts-fsrs` `Card` object as JSON in a `review_state` column; update via `scheduler.next(card, now, rating).card`; "due today" = `review_state.due <= now`; ratings `Rating.Again | Hard | Good | Easy`.
- Canonical API (spike, verbatim from README): `fsrs()` → scheduler; `createEmptyCard()` → new card; `scheduler.next(card, new Date(), Rating.Good)` → `{ card, log }`.
- `/review` needs no gating code — middleware default-deny covers it (`src/middleware.ts`).

## What We're NOT Doing

- **Not building F-02 (flashcard table + RLS) or S-01/S-02 (generation, save-to-deck)** — hard prerequisites; this plan assumes the `flashcard` table exists with per-user RLS. **S-04 is blocked until F-02 and S-02 land.**
- Not using per-user optimized FSRS parameters — MVP uses default `fsrs()` params (see Open Questions).
- Not building card edit/delete (that's S-03).
- Not adding a metrics/streaks dashboard.

## Implementation Approach

Three vertical phases on top of the assumed `flashcard` table: (1) add the `ts-fsrs` dependency, a `review_state` column, and a thin scheduler helper; (2) a rating-submission API endpoint that lazy-inits state and reschedules; (3) the `/review` session page (React island) that walks the due queue. Each phase cites the spike for contract decisions rather than inventing them.

## Phase 1: Data & scheduler foundation

### Overview

Make review state storable and give the app one place to compute FSRS transitions.

### Changes Required:

#### 1. Add the SRS dependency

**File**: `package.json`

**Intent**: Add `ts-fsrs` (FSRS scheduler) as a runtime dependency — the library chosen in the F-03 spike.

**Contract**: `ts-fsrs` 5.x in `dependencies`; Node ≥20 already satisfied.

#### 2. review_state column

**File**: `supabase/migrations/<timestamp>_add_review_state.sql`

**Intent**: Add a nullable JSON column to the flashcard table to hold the `ts-fsrs` `Card` object. Nullable so pre-existing cards lazy-init on first review.

**Contract**: `review_state jsonb null` on the `flashcard` table (table owned by F-02). Naming `YYYYMMDDHHmmss_short_description.sql` per repo convention; preserve existing RLS on the table.

#### 3. Scheduler helper

**File**: `src/lib/srs.ts`

**Intent**: Wrap `ts-fsrs` so the rest of the app never imports the library directly: create the scheduler, lazy-init an empty card, apply a rating, and expose the "is due" predicate.

**Contract**: exports (a) `emptyReviewState()` → `createEmptyCard()`; (b) `applyRating(state, rating, now)` → `fsrs().next(state, now, rating).card`; (c) `isDue(state, now)` → `state.due <= now`. Rating type re-exported from `ts-fsrs` (`Again|Hard|Good|Easy`).

### Success Criteria:

#### Automated Verification:

- Type/astro check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Migration applies cleanly against a local Supabase (`supabase db reset` or equivalent)

#### Manual Verification:

- `ts-fsrs` imports and `emptyReviewState()` returns a Card with `due`, `stability`, `difficulty`, `state`.

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Rating-submission API

### Overview

An endpoint that reschedules a card from a user's rating.

### Changes Required:

#### 1. Submit-rating endpoint

**File**: `src/pages/api/review/submit-rating.ts`

**Intent**: Accept a card id + rating, load the card scoped to the current user, lazy-init `review_state` if null, apply the rating via the scheduler helper, and persist the new state.

**Contract**: `export const POST: APIRoute`. Input: card id + one of `Again|Hard|Good|Easy`. Auth: reject if `!context.locals.user`. Data: read/write the flashcard row via `createClient(...)` (RLS enforces ownership). On success return the updated state (and/or the next due card). Follows the endpoint shape in `src/pages/api/auth/signin.ts:4-20`. Never trust a client-supplied user id — derive from `context.locals.user`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- POST a rating for a card → `review_state.due` moves into the future; `reps` increments.
- Rating a card with null `review_state` lazy-inits it (no error).
- A user cannot rate another user's card (RLS returns nothing → 404/refusal, not a write).

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Review session page

### Overview

The user-facing due-queue session.

### Changes Required:

#### 1. Review page

**File**: `src/pages/review.astro`

**Intent**: Protected page (auto-gated by middleware) that loads the current user's cards due today and hands them to an interactive island.

**Contract**: server-load cards where `review_state` is null OR `review_state.due <= now`, scoped to `context.locals.user`; render the queue via a React island; empty queue → "nothing due" state.

#### 2. Review session island

**File**: `src/components/review/ReviewSession.tsx`

**Intent**: Walk the queue: show front → reveal back → four rating buttons; on rating, POST to `/api/review/submit-rating`, advance to the next card; finish when the queue is empty.

**Contract**: React island (interactivity), Tailwind via `cn()` from `@/lib/utils` for conditional classes (project convention); four buttons mapped to `Again|Hard|Good|Easy`; optimistic advance or await response then advance.

### Success Criteria:

#### Automated Verification:

- Type/astro check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Logged in with due cards: `/review` shows them in sequence; reveal + rate advances the queue.
- Rating persists (reload → rated card no longer due today).
- Empty queue shows the done/nothing-due state.
- Logged out: `/review` redirects to `/auth/signin` (middleware).

**Implementation Note**: Pause for manual confirmation.

---

## Testing Strategy

### Manual Testing Steps:

1. Seed a user's deck (via F-02/S-02) with a few cards, at least one due now.
2. `/review` → due cards appear one at a time; reveal + rate each.
3. After rating, the card's `due` is in the future and it leaves the queue.
4. Empty the queue → done state.
5. Second user → never sees the first user's cards (RLS).

(The starter ships no unit-test harness; verification is astro check + lint + build + manual. A unit test for `src/lib/srs.ts` transitions would be valuable if a runner is added — out of scope here.)

## Migration Notes

`review_state` is nullable and lazy-initialized, so no backfill is needed for cards created before this slice.

## References

- Internal research: `context/changes/srs-review-session/research.md`
- Library spike (contract source): `context/changes/srs-library-spike/research.md`
- Endpoint reference shape: `src/pages/api/auth/signin.ts:4-20`
- Gating substrate: `src/middleware.ts:19-46`
- Roadmap: `context/foundation/roadmap.md` (S-04)

## Open Questions

> Left explicit per the F-03 spike — the plan does NOT guess these. Resolve before/at implementation.

1. **Edit-vs-reset policy** — when a card's front/back is edited (S-03), does its `review_state` reset (`createEmptyCard`) or persist? FSRS state is tied to the item; a content change may warrant a reset. Owner: user. Blocks: clean interaction between S-03 and S-04, not this plan's core.
2. **Model parameters** — default `fsrs()` params for MVP vs per-user optimized params (needs the optimizer + review history). MVP assumption: default params. Owner: user.
3. **"Today" boundary / timezone** — is "due today" evaluated in UTC or the user's local time? Affects the due query in Phase 3. Owner: user.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.
> NOTE: S-04 is BLOCKED until F-02 (flashcard table + RLS) and S-02 (save-to-deck) exist. Do not start Phase 1 before then.

### Phase 1: Data & scheduler foundation

#### Automated

- [x] 1.1 Type/astro check passes: `npx astro sync && npx astro check` (0 errors) — 0d60d5f
- [x] 1.2 Lint passes: `npm run lint` — 0d60d5f
- [x] 1.3 Build passes: `npm run build` — 0d60d5f
- [x] 1.4 Migration N/A — `review_state jsonb` already shipped in F-02 migration `20260710120000_create_flashcards.sql:14`; no new migration needed — 0d60d5f

#### Manual

- [x] 1.5 `ts-fsrs` imports; `emptyReviewState()` returns a Card with due/stability/difficulty/state — confirmed via node probe + `src/lib/srs.test.ts` (4 tests, incl. jsonb round-trip) — 0d60d5f

### Phase 2: Rating-submission API

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — caa89e0
- [x] 2.2 Build passes: `npm run build` — caa89e0

#### Manual

- [x] 2.3 POST rating moves `review_state.due` to future, increments `reps` — unit-covered (`review-rating.test.ts`); live-DB check → R1 integration test — caa89e0
- [x] 2.4 Rating a card with null `review_state` lazy-inits without error — unit-covered (lazy-init test) — caa89e0
- [x] 2.5 A user cannot rate another user's card (RLS) — handler maps not-found→404; live RLS → R1 integration test — caa89e0

### Phase 3: Review session page

#### Automated

- [x] 3.1 Type/astro check passes: `npx astro sync && npx astro check` (0 errors) — 0743096
- [x] 3.2 Lint passes: `npm run lint` — 0743096
- [x] 3.3 Build passes: `npm run build` — 0743096

#### Manual

- [ ] 3.4 Logged in with due cards: `/review` walks the queue (reveal + rate advances) — user browser step
- [ ] 3.5 Rating persists (reload → card no longer due today) — user browser step
- [ ] 3.6 Empty queue shows done / nothing-due state — user browser step
- [x] 3.7 Logged out: `/review` redirects to `/auth/signin` — covered by default-deny middleware + `route-access` tests (unknown routes protected) — 0743096
