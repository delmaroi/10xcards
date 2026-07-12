# Minimal flashcard persistence (F-02) — Plan Brief

> Full plan: `context/changes/minimal-flashcard-persistence/plan.md`
> SRS contract: `context/changes/srs-library-spike/research.md`

## What & Why

The persistence foundation the whole product stands on: a per-user `flashcards` table isolated by Supabase RLS. Roadmap F-02 (PRD FR-007 + data-isolation guardrail). Nothing can persist a card without it — it unblocks S-01→S-05 and the blocked test-rollout phases.

## Starting Point

No data layer exists (only `supabase/config.toml`, no migrations, no `src/types.ts`). Auth + the SSR Supabase client are present; RLS keys off `auth.uid()`, carried by the session cookie.

## Desired End State

A `flashcards` table with RLS enabled and per-operation owner policies. An authenticated user can CRUD only their own cards; a second user sees nothing. A `Flashcard` TS type mirrors the schema. Migration applies cleanly; project type-checks and builds.

## Key Decisions Made

| Decision        | Choice                                      | Why                                                        | Source   |
| --------------- | ------------------------------------------- | ---------------------------------------------------------- | -------- |
| Deck model      | Single implicit deck (`flashcards.user_id`) | PRD "talia" is singular; minimal; unblocks S-01/S-02       | Plan     |
| Drafts          | Ephemeral (only accepted persist)           | F-02 = just the deck; drafts are S-01's flow               | Plan     |
| `review_state`  | Add `jsonb null` now                        | SRS spike; avoids a 2nd migration; lazy-init in S-05       | Research |
| `source` column | Include (`ai`/`manual`)                     | Feeds FR-004's AI-share metric; cheap now                  | Plan     |
| Isolation       | Supabase RLS, `auth.uid() = user_id`        | The data-isolation guardrail lives in the DB, not app code | PRD      |

## Scope

**In scope:** one migration (table + RLS + 4 owner policies + `updated_at` trigger); `Flashcard`/`FlashcardInput` types.

**Out of scope:** decks table, drafts table, data-access helper/API/UI (S-01/S-02), SRS logic (S-05), admin policies.

## Architecture / Approach

Single SQL migration under `supabase/migrations/`; RLS enabled with per-operation policies (insert via `WITH CHECK`). Hand-written types in `src/types.ts`. Migration defines the contract; types mirror it.

## Phases at a Glance

| Phase              | What it delivers                     | Key risk                                                                                          |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1. Migration + RLS | `flashcards` table isolated per user | RLS enabled without policies (denies all) or policies without RLS (ignored) — both silently wrong |
| 2. Types           | `Flashcard` type in `src/types.ts`   | Type drifts from migration columns                                                                |

**Prerequisites:** a running Supabase to apply/verify the migration (`npx supabase start` locally, or the cloud project) — the human's step. Node ≥20 satisfied.
**Estimated effort:** ~1 short session, 2 phases.

## Open Risks & Assumptions

- **Requires Supabase running** to verify Phase 1; the agent writes SQL, the human applies it.
- RLS correctness is best proven by the integration test in test-rollout Phase 2 (R1), which this migration unblocks.
- Assumes `auth.uid()` is available to the SSR client via the session cookie (it is, per `src/lib/supabase.ts`).

## Success Criteria (Summary)

- Migration applies; RLS on with 4 owner policies.
- User A's cards are invisible/untouchable to user B (isolation guardrail).
- `Flashcard` type resolves; `astro check` + `build` + `lint` green.
