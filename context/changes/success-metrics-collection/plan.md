# Success-metrics collection (S-04) Implementation Plan

## Overview

Collect the data needed to measure the PRD's two success criteria: **(1) AI acceptance rate** (≥75% of AI-generated proposals accepted) and **(2) AI-share** (≥75% of cards created via AI). Roadmap S-04 (PRD FR-004, Success Criteria prd.md:47-48). Per PRD (prd.md:89), **collection is must-have; the admin review UI is nice-to-have** — so the core is a capture path, with only a minimal metrics surface.

## Current State Analysis

- **Generation loop shipped (S-01/S-02):** `src/components/generate/GenerateForm.tsx` holds per-proposal `decision` (accept/edit/reject) client-side; on save it POSTs only accepted `{front,back}` to `/api/flashcards` (`src/lib/save-flashcards.ts`). Rejected/edited counts are currently **discarded** — the audit's core gap.
- **AI-share substrate already exists:** `flashcards.source` (`'ai'|'manual'`, F-02 migration) — no new capture needed for metric (2).
- **Conventions:** framework-free handler + thin `APIRoute` (`generate-request.ts`, `save-flashcards.ts`); SSR client `createClient(...)`; owner-scoped RLS; `astro:env/server` secrets; colocated `*.test.ts`.
- **No admin concept yet** (FR-003 Parked). Middleware default-deny gates all non-public routes to logged-in users.

## Desired End State

Every completed generation-triage produces a `generation_stats` row (`generated`, `accepted`, `edited`, owner-scoped). A minimal, admin-gated `/admin/metrics` page shows the two metrics computed from `generation_stats` (acceptance rate) and `flashcards.source` (AI-share). Non-admins are refused.

Verify: generate N proposals, reject some, accept the rest, save → a `generation_stats` row records the counts; `/admin/metrics` (as an allowlisted email) shows acceptance rate and AI-share; a non-admin logged-in user is refused.

## What We're NOT Doing

- **No org-wide cross-user aggregation** — RLS is owner-scoped; a product-wide roll-up needs a service-role read (deferred, nice-to-have). The metrics page reports over the data the caller can see.
- **No rich admin dashboard / charts** (PRD: nice-to-have) — a plain numbers page only.
- **No role system / admin user management** (FR-003, Parked) — admin = `ADMIN_EMAILS` env allowlist.
- **No manual-create instrumentation** (FR-008 not built) — AI-share reads the existing `source` column.
- **No retroactive backfill** — metrics accrue from this slice forward.

## Implementation Approach

Three phases: (1) `generation_stats` table + RLS + type; (2) a framework-free recording handler + endpoint, wired into the save flow so counts are captured at triage-commit; (3) a minimal admin-gated metrics page computing both ratios.

## Phase 1: generation_stats table + type

### Changes Required:

#### 1. Migration
**File**: `supabase/migrations/<timestamp>_create_generation_stats.sql`
**Intent**: Owner-scoped table capturing one row per saved generation batch.
**Contract**: `generation_stats(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, generated int not null check (generated >= 0), accepted int not null check (accepted >= 0), edited int not null default 0 check (edited >= 0), created_at timestamptz not null default now())`; index on `user_id`; RLS enabled + owner insert (`with check auth.uid()=user_id`) and owner select policies. Naming `YYYYMMDDHHmmss_create_generation_stats.sql`.

#### 2. Type
**File**: `src/types.ts`
**Intent**: Add `GenerationStat` mirroring the row + `GenerationStatInput` (`generated`, `accepted`, `edited`).

### Success Criteria:
#### Automated:
- `npx astro sync && npx astro check` passes; `npm run lint`; `npm run build`.
#### Manual:
- Migration applies to the cloud Supabase (Studio SQL editor); RLS enabled + 2 policies.

## Phase 2: record stats at save

### Changes Required:

#### 1. Recording handler
**File**: `src/lib/record-generation-stats.ts`
**Intent**: Framework-free `handleRecordStats({ userId, body, insertStat })` — validate `{generated, accepted, edited}` (zod, non-negative ints, `accepted+? <= generated` sanity), owner-scope, single insert. 401/400/500/201.

#### 2. Endpoint
**File**: `src/pages/api/metrics/generation.ts`
**Intent**: Thin `POST` wrapper — user from `context.locals.user`, `createClient`, delegate.

#### 3. Wire the client
**File**: `src/components/generate/GenerateForm.tsx`
**Intent**: After a successful save to `/api/flashcards`, POST the batch counts (`generated` = proposals returned, `accepted` = accepted decisions, `edited` = accepted-and-edited) to `/api/metrics/generation`. Best-effort: a metrics failure must not break the save UX.

### Success Criteria:
#### Automated:
- Unit: handler 401/400/500/201; counts validated; single insert. `npm run lint`; `npm run build`.
#### Manual:
- Generate → reject some → save → a `generation_stats` row holds the right counts.

## Phase 3: minimal admin metrics surface

### Changes Required:

#### 1. Admin allowlist
**File**: `astro.config.mjs` (+ `src/lib/is-admin.ts`)
**Intent**: Add `ADMIN_EMAILS` to the env schema (server, optional). `isAdmin(email)` parses the comma list.
**Contract**: pure, unit-testable predicate; empty/unset list → nobody is admin.

#### 2. Metrics page
**File**: `src/pages/admin/metrics.astro`
**Intent**: Gated to admin emails (non-admin → refuse / redirect). Compute acceptance rate = Σaccepted / Σgenerated from `generation_stats`; AI-share = count(source='ai') / count(*) from `flashcards`. Render the two numbers + sample sizes.

### Success Criteria:
#### Automated:
- Unit: `isAdmin` allow/deny. `npx astro check`; `npm run lint`; `npm run build`.
#### Manual:
- As an allowlisted email `/admin/metrics` shows both metrics; as a non-admin logged-in user it is refused; logged-out → signin (middleware).

## Testing Strategy

Unit-test the framework-free handler + `isAdmin` (colocated `*.test.ts`, matching the repo). Live DB/RLS + admin-gate behavior are manual (as elsewhere; a full integration test is test-plan Phase 2 / R1 territory).

## References

- Roadmap: `context/foundation/roadmap.md` (S-04)
- PRD: FR-004, Success Criteria (prd.md:47-48), collection-vs-UI note (prd.md:89)
- Save flow: `src/lib/save-flashcards.ts`, `src/components/generate/GenerateForm.tsx`
- AI-share column: `supabase/migrations/20260710120000_create_flashcards.sql` (`source`)

## Progress

> `- [ ]` pending, `- [x]` done. Append ` — <sha>` when a step lands.

### Phase 1: generation_stats table + type
#### Automated
- [x] 1.1 astro check passes (0 errors) — 26b4b74
- [x] 1.2 lint passes — 26b4b74
- [x] 1.3 build passes — 26b4b74
#### Manual
- [ ] 1.4 Migration applies to cloud Supabase; RLS enabled + 2 owner policies — user step (Studio SQL editor)

### Phase 2: record stats at save
#### Automated
- [x] 2.1 Unit: handler 401/400/500/201 + count validation + single insert (6 tests) — 6d603c9
- [x] 2.2 lint passes — 6d603c9
- [x] 2.3 build passes — 6d603c9
#### Manual
- [ ] 2.4 Generate → reject some → save → generation_stats row has correct counts — user step (after migration applied)

### Phase 3: minimal admin metrics surface
#### Automated
- [x] 3.1 Unit: isAdmin allow/deny (4 tests)
- [x] 3.2 astro check passes (0 errors)
- [x] 3.3 lint passes
- [x] 3.4 build passes
#### Manual
- [ ] 3.5 Admin email sees both metrics at /admin/metrics — user step (needs ADMIN_EMAILS + migration + login)
- [ ] 3.6 Non-admin logged-in user is refused (403 render); logged-out → signin (middleware) — user step
