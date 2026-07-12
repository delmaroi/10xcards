# Deck edit & delete (S-03) Implementation Plan

## Overview
Make the deck manageable: browse, edit and delete saved cards (FR-009/010/011). Builds on S-02's `/deck` + `flashcards` table. Edit/delete owner-scoped by RLS.

## Current State Analysis
- S-02 shipped `/deck` (static SSR list), `flashcards` table + RLS, `save-flashcards` handler + `/api/flashcards` (POST).
- Pattern: framework-free handler + thin `APIRoute`; SSR client; `cn()`; React islands for interactivity.

## Desired End State
`/deck` renders an interactive list. Each card can be edited inline (Save persists front/back) or deleted (with confirm). Only the owner's cards can be changed (RLS); editing/deleting a card you don't own returns 404. Reload reflects persisted changes.

## What We're NOT Doing
- No SRS/review (S-05). No manual create (FR-008). No bulk ops.

## Critical Implementation Details
- **Ownership check via affected rows:** update/delete with `.eq("id", id).select("id")` — RLS makes a non-owner's statement affect 0 rows → return 404, not a leak.
- Live DB/UI verification needs app+login (R1 territory) — user's step; handlers unit-tested with injected fns.

## Phase 1: Update + delete handlers + endpoint

### Changes Required:
#### 1. Mutation handlers
**File**: `src/lib/deck-mutations.ts`
**Intent**: Framework-free `handleUpdateCard` / `handleDeleteCard`: auth + validation + map affected-rows to status. Injected update/delete fns (unit-testable).
**Contract**: update — no user→401; zod body `{front,back}`→400 else; not found (0 rows)→404; error→500; ok→200 `{updated:true}`. delete — no user→401; not found→404; error→500; ok→200 `{deleted:true}`.

#### 2. Per-card endpoint
**File**: `src/pages/api/flashcards/[id].ts`
**Intent**: `PATCH` + `DELETE` exports; read user + SSR client, delegate. update/delete use `.eq("id", id).select("id")` to detect ownership match.

### Success Criteria:
#### Automated:
- astro check + build + lint pass.
- Unit: update 401/400/404/500/200; delete 401/404/500/200; "found" derives from affected rows.
#### Manual:
- (app+login) editing another user's card id → 404; own card updates.

## Phase 2: Interactive deck

### Changes Required:
#### 1. Deck list island
**File**: `src/components/deck/DeckList.tsx`
**Intent**: Render cards from an initial prop; per card: Edit (inline inputs + Save → PATCH) / Delete (confirm → DELETE, remove from list); errors surfaced.
**Contract**: props `{ cards: {id,front,back}[] }`; `getByRole`-friendly (Edit/Save/Delete buttons); `cn()` styling.

#### 2. Wire /deck
**File**: `src/pages/deck.astro`
**Intent**: Pass the SSR-fetched cards to `<DeckList client:load />` instead of a static list.
**Contract**: keeps the empty state; hands `id, front, back` to the island.

### Success Criteria:
#### Automated:
- astro check + build + lint pass.
#### Manual:
- (app+login) edit a card → persists after reload; delete → gone after reload; logged-out /deck → signin.

## References
- S-02: `context/changes/atomic-save-to-deck/plan.md`; endpoint pattern: `src/lib/save-flashcards.ts`
- FR-009/010/011; test-plan R1

## Progress
> `- [ ]` pending, `- [x]` done.

### Phase 1: Update + delete handlers + endpoint
#### Automated
- [x] 1.1 astro check + build + lint pass
- [x] 1.2 Unit: update 401/400/404/500/200; delete 401/404/500/200
#### Manual
- [x] 1.3 own card updates/deletes — confirmed working; cross-user 404 → R1 integration test

### Phase 2: Interactive deck
#### Automated
- [x] 2.1 astro check + build + lint pass
#### Manual
- [x] 2.2 Edit persists after reload; delete removes after reload — confirmed working in browser
- [x] 2.3 Logged-out /deck redirects to /auth/signin — default-deny middleware + route-access test
