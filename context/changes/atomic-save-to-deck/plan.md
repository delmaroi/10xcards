# Atomic save to deck (S-02) Implementation Plan

## Overview

Close the gated loop (north star): the accepted proposals from S-01 are saved atomically to the user's deck, and the user can see the saved cards. Roadmap S-02 (PRD US-01, FR-007, FR-009). Only accepted cards persist (R2); the save is all-or-nothing (R4); rows are owner-isolated by RLS (R1).

## Current State Analysis
- **F-02 applied** — `flashcards` table (user_id, front, back, source, review_state, timestamps) + RLS owner policies exist in the cloud project.
- **S-01 built** — `GenerateForm` holds accepted proposals client-side; a disabled "Save to deck (S-02)" button is already present. `/api/generate` + the SSR client + `Flashcard` type exist.
- **Conventions:** thin `APIRoute` + framework-free handler (like `generate-request.ts`), SSR client `createClient(headers, cookies)`, `@/*`, `cn()`.

## Desired End State
Clicking "Save to deck" POSTs the accepted proposals to `/api/flashcards`; they are inserted in one atomic statement scoped to the user; the UI confirms and the user can view them at `/deck`. Rejected/pending proposals never persist. A second user never sees these rows.

Verify: accept N proposals → save → `/deck` shows exactly those N; rejected ones absent; reload persists; another user sees none.

## What We're NOT Doing
- **No edit/delete of saved cards** — that's S-03.
- **No SRS** — `review_state` stays null (S-04).
- **No per-card save** — the accepted set saves as one atomic batch.

## Critical Implementation Details
- **Atomicity (R4):** insert the whole accepted array in a single `supabase.from("flashcards").insert(rows)` call — one statement is all-or-nothing. Do NOT loop per-row.
- **Ownership:** set `user_id` from `context.locals.user` (never client-supplied); RLS `WITH CHECK` also enforces it.
- Live DB/RLS verification needs the running app + a session (R1 integration test territory) — user's step. Handler logic is unit-tested with an injected insert fn.

## Phase 1: Save handler + endpoint

### Changes Required:

#### 1. Save handler
**File**: `src/lib/save-flashcards.ts`
**Intent**: Framework-free handler: validate the accepted cards, build owner-scoped rows, insert them atomically via an injected insert fn, map to a status.
**Contract**: `handleSaveRequest({ userId: string|null; body: unknown; insertCards: (rows) => Promise<{ error: unknown }> }): Promise<{ status; body }>`. No user → 401; zod-invalid body (`{ cards: {front,back}[] }`, min 1) → 400; insert error → 500; success → 201 `{ saved: n }`. Rows = `{ user_id, front, back, source: "ai" }`.

#### 2. Save endpoint
**File**: `src/pages/api/flashcards.ts`
**Intent**: Thin `POST` wrapper — read user + SSR client, delegate to the handler, pass a single-`insert` closure.
**Contract**: `export const POST: APIRoute`; `insertCards` = `supabase.from("flashcards").insert(rows)` (one atomic call).

### Success Criteria:
#### Automated Verification:
- astro check + build + lint pass.
- Unit: no user → 401; bad body → 400; only accepted rows built (rejected/pending excluded by caller); insert error → 500; success → 201 with count; insert called once with all rows (atomic).
#### Manual Verification:
- (needs app+login) Save inserts rows owner-scoped; a forced insert error leaves nothing saved.

**Implementation Note**: Pause before Phase 2.

## Phase 2: Wire UI + deck view

### Changes Required:

#### 1. Wire "Save to deck"
**File**: `src/components/generate/GenerateForm.tsx`
**Intent**: Enable the button to POST accepted proposals to `/api/flashcards`; on success confirm + offer a link to `/deck`; handle errors.
**Contract**: sends `{ cards: accepted.map({front,back}) }`; disabled while saving / when 0 accepted; shows saved confirmation.

#### 2. Deck view
**File**: `src/pages/deck.astro`
**Intent**: Protected page listing the user's saved cards (FR-009), newest first, via the SSR client (RLS-scoped).
**Contract**: server-query `flashcards` (`id, front, back, created_at`) for the session user; render list; empty state when none.

### Success Criteria:
#### Automated Verification:
- astro check + build + lint pass.
#### Manual Verification:
- (needs app+login) Accept N → Save → `/deck` shows those N; rejected absent; reload persists; logged-out `/deck` → signin.

**Implementation Note**: Final step — optionally note the R1/R4 integration test as now unblocked in test-plan.

## References
- F-02: `context/changes/minimal-flashcard-persistence/plan.md`
- S-01: `context/changes/first-gated-generation/plan.md`
- Endpoint pattern: `src/lib/generate-request.ts`, `src/pages/api/generate.ts`
- Test-plan risks: R1, R2, R4

## Progress
> `- [ ]` pending, `- [x]` done.

### Phase 1: Save handler + endpoint
#### Automated
- [x] 1.1 astro check + build + lint pass
- [x] 1.2 Unit: 401/400/500/201; single atomic insert with all accepted rows
#### Manual
- [ ] 1.3 (app+login) owner-scoped insert; forced error saves nothing

### Phase 2: Wire UI + deck view
#### Automated
- [x] 2.1 astro check + build + lint pass
#### Manual
- [ ] 2.2 Accept N → Save → /deck shows N; rejected absent; reload persists (browser + login — user step)
- [x] 2.3 Logged-out /deck redirects to /auth/signin — default-deny middleware + route-access test (unknown routes protected)
