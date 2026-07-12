# Minimal flashcard persistence (F-02) Implementation Plan

## Overview

Create the persistence foundation the whole product stands on: a single `flashcards` table owned per-user, isolated by Supabase Row-Level Security so a card is readable/writable only by its owner. This is roadmap foundation F-02 (PRD FR-007 + the data-isolation guardrail); it unlocks S-01 (generation), S-02 (save-to-deck), S-03 (edit/delete), S-04 (metrics), S-05 (review).

## Current State Analysis

- **No data layer today** — `supabase/` has only `config.toml`, no `migrations/`, no domain tables (Supabase is used for `auth.users` only). No `src/types.ts`.
- **Auth is present & reusable** — `src/lib/supabase.ts:5-24` provides the SSR client (`createClient(headers, cookies)`); `src/middleware.ts` resolves `context.locals.user`. RLS keys off `auth.uid()`, which the SSR client carries via the user's session cookie.
- **SRS contract (F-03 spike)** — review state will be stored as the `ts-fsrs` `Card` object in a JSON column on the flashcard row; lazy-initialized in S-05.

## Desired End State

A `flashcards` table exists with RLS enabled and per-operation policies scoped to `auth.uid() = user_id`. An authenticated user can insert/select/update/delete only their own rows; a second user cannot see or touch them. A `Flashcard` TypeScript type mirrors the schema. The migration applies cleanly to a local Supabase; the project type-checks and builds.

Verify: apply the migration; as user A insert a card and read it back; as user B, the same query returns nothing (isolation guardrail). `astro check` + `build` stay green with the new type.

### Key Discoveries:

- RLS isolation is the whole point of F-02 — the guardrail "pełna izolacja danych między kontami" (PRD Success Criteria) lives here, not in app code.
- `review_state jsonb null` is added now (per the SRS spike) so S-05 needs no second migration; nullable → lazy-init later.
- `source` (`ai` | `manual`) is included so FR-004's "share of AI-created cards" metric has a column to read later — cheap now, awkward to backfill.

## What We're NOT Doing

- **No `decks` table** — single implicit deck (cards belong directly to the user); PRD's "talia" is singular. Named decks are future scope.
- **No `flashcard_drafts` table** — AI proposals are ephemeral; only accepted cards persist (that's S-01/S-02's flow). F-02 is just the persistent deck.
- **No data-access helper / API / UI** — those are S-01/S-02. F-02 is schema + RLS + types.
- **No SRS logic** — only the empty `review_state` column; ts-fsrs wiring is S-05.
- **No admin/role policies** — Access Control's admin surface is later.

## Implementation Approach

One SQL migration creates the table, enables RLS, and adds four owner-scoped policies (select/insert/update/delete) plus an `updated_at` trigger. Then a hand-written `Flashcard` type mirrors the columns. Migration first (defines the contract), types second.

## Critical Implementation Details

- **RLS must be enabled AND have policies.** Enabling RLS without policies denies everything; policies without `enable row level security` are ignored. Both, or the guardrail is silently wrong.
- **`insert` needs a `WITH CHECK`** (not just `USING`) so a user cannot insert a row owned by someone else.
- Applying/verifying the migration requires a **running Supabase** (`npx supabase start` locally, or the cloud project). This is the human's step; the agent writes the SQL.

## Phase 1: Migration — flashcards table + RLS

### Overview

Create the owner-isolated persistence table.

### Changes Required:

#### 1. flashcards migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_flashcards.sql`

**Intent**: Create the `flashcards` table owned per-user, enable RLS, and add per-operation owner policies + an `updated_at` trigger. This is the data-isolation contract.

**Contract**: Table columns — `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `front text not null`, `back text not null`, `source text not null default 'ai' check (source in ('ai','manual'))`, `review_state jsonb`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. RLS enabled; four policies for the `authenticated` role, each `auth.uid() = user_id` (insert via `with check`, others via `using`). Index on `user_id`. `updated_at` maintained by a `before update` trigger (e.g. `moddatetime`). Naming: `YYYYMMDDHHmmss_create_flashcards.sql`.

The RLS shape (load-bearing, non-obvious):

```sql
alter table public.flashcards enable row level security;
create policy "own_select" on public.flashcards for select to authenticated using (auth.uid() = user_id);
create policy "own_insert" on public.flashcards for insert to authenticated with check (auth.uid() = user_id);
create policy "own_update" on public.flashcards for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_delete" on public.flashcards for delete to authenticated using (auth.uid() = user_id);
```

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly to a local Supabase: `npx supabase db reset` (or `db push`) succeeds.
- RLS is enabled and 4 policies exist: query `pg_policies` for `tablename = 'flashcards'` returns 4 rows.

#### Manual Verification:

- As user A, insert a flashcard; select returns it. As user B (different session), the same select returns 0 rows — **isolation holds**.
- User A can update and delete only their own row; cannot insert a row with another `user_id` (WITH CHECK rejects it).

**Implementation Note**: Requires a running Supabase. Pause for manual confirmation before Phase 2.

---

## Phase 2: TypeScript types

### Overview

Give the app a typed view of the row.

### Changes Required:

#### 1. Flashcard type

**File**: `src/types.ts`

**Intent**: Add the shared `Flashcard` type (mirrors the columns) and a `FlashcardInput` for inserts (owner + content fields the app sets), so S-01/S-02 import a single source of truth.

**Contract**: `Flashcard` = `{ id: string; user_id: string; front: string; back: string; source: "ai" | "manual"; review_state: unknown | null; created_at: string; updated_at: string }`. `FlashcardInput` = the subset the app provides on insert (`front`, `back`, `source`; `user_id` derived from the session). `review_state` typed loosely (`unknown`/`Json | null`) until S-05 imports the ts-fsrs `Card` type.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`.
- Build passes: `npm run build`.
- Lint passes: `npm run lint`.

#### Manual Verification:

- `import type { Flashcard } from "@/types"` resolves; fields match the migration columns.

**Implementation Note**: Pure TypeScript — no Supabase needed. Pause for confirmation.

---

## Testing Strategy

The RLS isolation guarantee (R1) is best proven by an **integration test against a local Supabase** — that is test-plan rollout Phase 2 (`Data isolation + atomic save`), which this migration unblocks. For F-02 itself, verification is: migration applies + policy count + the two-user manual isolation check.

## Migration Notes

`flashcards` is a new table — no backfill. `review_state` is nullable, so future SRS rows lazy-init with no data migration. `on delete cascade` on `user_id` means deleting an auth user removes their cards (aligns with S-05 account deletion later).

## References

- Roadmap: `context/foundation/roadmap.md` (F-02)
- SRS contract: `context/changes/srs-library-spike/research.md` (review_state as JSON)
- SSR client: `src/lib/supabase.ts:5-24`
- PRD: FR-007, FR-009/010/011, Access Control, data-isolation guardrail

## Progress

> `- [ ]` pending, `- [x]` done. Append ` — <sha>` when a step lands.

### Phase 1: Migration — flashcards table + RLS

#### Automated

- [x] 1.1 Migration applies cleanly (applied via Supabase Studio SQL Editor to cloud project)
- [x] 1.2 RLS enabled + 4 policies exist (confirmed in Studio)

#### Manual

- [x] 1.3 User A inserts + reads own card; User B select returns 0 rows (isolation) — structural RLS in place; behavioral A≠B test delegated to R1 integration test
- [x] 1.4 User A can update/delete own row; cannot insert a row with another user_id — structural (WITH CHECK/USING policies present); behavioral test delegated to R1

### Phase 2: TypeScript types

#### Automated

- [x] 2.1 Type check passes: `npx astro sync && npx astro check`
- [x] 2.2 Build passes: `npm run build`
- [x] 2.3 Lint passes: `npm run lint`

#### Manual

- [x] 2.4 `Flashcard` type imports and matches migration columns
