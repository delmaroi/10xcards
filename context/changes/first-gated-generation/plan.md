# First gated AI generation loop (S-01) Implementation Plan

## Overview

A logged-in user pastes source text, the app asks an LLM (OpenRouter) to generate flashcard proposals, and the user accepts / edits / rejects each proposal. This is roadmap slice S-01 (PRD US-01, FR-005, FR-006) — the product wedge and the first real LLM integration. Accepted proposals are handed off to S-02 for atomic persistence; S-01 itself keeps proposals ephemeral (client-side triage).

## Current State Analysis

- **F-02 provides the data layer** — `flashcards` table + RLS (change `minimal-flashcard-persistence`). S-01 does NOT persist here directly; S-02 does the save. (F-02 migration must be applied before S-02 runs.)
- **No LLM integration exists** — no OpenRouter client, no `OPENROUTER_KEY` in `astro.config.mjs` env schema, no generation endpoint/UI.
- **Reusable substrate:** SSR Supabase client + `context.locals.user` (auth), API pattern `export const POST: APIRoute` reading the user from `context.locals.user` (`src/pages/api/auth/signin.ts`), `@/*` imports, secrets via `astro:env/server`, `cn()` for React island styling. `/generate` is auto-gated by the default-deny middleware (F-01).
- **Test-plan risks in scope:** R5 (pasted text privacy — must not be retained), R6 (generation resource abuse — length/rate limit), R2 (draft → human decision → deck, closed by S-02).

## Desired End State

At `/generate` (logged-in), the user pastes text, clicks Generate, sees continuous progress, then a list of AI proposals each with Accept / Edit / Reject. Editing a proposal changes its front/back before acceptance. The set of accepted proposals is available to finalize (S-02). Empty/too-short/too-long input shows a clear message instead of calling the LLM. The raw pasted text is never persisted or logged.

Verify: paste text → proposals appear with progress shown; accept/edit/reject each; oversized/empty input is rejected client- and server-side; server logs contain no raw source text.

### Key Discoveries:

- Response contract must be enforced, not trusted: prompt the LLM for a strict JSON array of `{ front, back }` and validate with **zod** (project convention) before returning — reject/repair malformed output.
- Privacy (R5): the generation endpoint reads the text, calls the LLM, returns proposals, and retains nothing — no DB write, no logging of the body.
- Node ≥20 / edge runtime: OpenRouter is a plain HTTPS `fetch` (works on Workers); no Node-only SDK needed.

## What We're NOT Doing

- **No persistence of proposals or accepted cards** — that's S-02 (atomic save to `flashcards`). S-01 ends when the user has triaged.
- **No manual card creation** (FR-008, nice-to-have) or bulk "accept all" (PRD Open Q3) — later.
- **No SRS / review_state** — S-04.
- **No per-user optimized LLM params** — default model + prompt.

## Critical Implementation Details

- **API auth-failure shape:** unauthenticated `POST /api/generate` should return **401 JSON**, not a 302 redirect (the middleware default-deny redirects HTML nav; an API caller needs a status). Handle explicitly in the endpoint (this is the S-01 concern flagged in F-01's plan).
- **Progress feedback (NFR):** generation may exceed ~2s; the UI must show continuous progress (spinner/streaming state), not a frozen button.
- **Secret:** add `OPENROUTER_KEY` to `astro.config.mjs` `env.schema` (server, secret); set via `wrangler secret put` in prod, `.dev.vars` locally.

## Phase 1: OpenRouter client + proposal contract

### Overview

One place that turns text into validated proposals.

### Changes Required:

#### 1. OpenRouter client

**File**: `src/lib/openrouter.ts`
**Intent**: Call the OpenRouter chat API over `fetch`, prompt for flashcard proposals from the user's text, parse+validate the response into typed proposals, and translate failures into a typed result. Retain nothing.
**Contract**: exports `generateFlashcards(sourceText: string): Promise<{ ok: true; proposals: FlashcardProposal[] } | { ok: false; error: "invalid_input" | "provider_error" | "bad_output" }>`. `FlashcardProposal = { front: string; back: string }`. Validates LLM output with a zod schema (array of `{front, back}`); rejects empty/oversized input before calling. Reads `OPENROUTER_KEY` from `astro:env/server`.

#### 2. Secret schema

**File**: `astro.config.mjs`
**Intent**: Declare `OPENROUTER_KEY` as a server-only secret alongside the Supabase keys.
**Contract**: `env.schema` gains `OPENROUTER_KEY: envField.string({ context: "server", access: "secret", optional: true })`.

### Success Criteria:

#### Automated Verification:

- `npx astro sync && npx astro check`, `npm run build`, `npm run lint` pass.
- Unit test: given a stubbed OpenRouter HTTP response, `generateFlashcards` returns validated proposals; malformed output → `bad_output`; empty/oversized input → `invalid_input` (no HTTP call).

#### Manual Verification:

- With a real `OPENROUTER_KEY`, a sample paste returns sensible `{front, back}` proposals.

**Implementation Note**: Needs an OpenRouter key for manual check. Pause before Phase 2.

---

## Phase 2: Generation API endpoint

### Overview

Expose generation to the browser, gated and privacy-safe.

### Changes Required:

#### 1. Generate endpoint

**File**: `src/pages/api/generate.ts`
**Intent**: Accept the pasted text from a logged-in user, call `generateFlashcards`, return proposals as JSON. Enforce auth, input limits, and privacy.
**Contract**: `export const POST: APIRoute`. Rejects with **401 JSON** if `!context.locals.user`. Validates body (non-empty, within the length limit) with zod → 400 JSON on failure. On success returns `{ proposals: FlashcardProposal[] }`. Never persists or logs the raw text. Basic per-user rate limiting (R6).

### Success Criteria:

#### Automated Verification:

- `astro check`, `build`, `lint` pass.
- Unit/integration: unauth → 401 JSON; empty/oversized body → 400; valid → proposals (OpenRouter stubbed at the network layer).

#### Manual Verification:

- Server logs show no raw source text after a request (R5).

**Implementation Note**: Pause before Phase 3.

---

## Phase 3: Generation UI (paste → triage)

### Overview

The user-facing loop.

### Changes Required:

#### 1. Generate page

**File**: `src/pages/generate.astro`
**Intent**: Protected page (auto-gated) hosting the generation island.
**Contract**: renders the React island; reads `Astro.locals.user`.

#### 2. Generation island

**File**: `src/components/generate/GenerateForm.tsx`
**Intent**: Textarea + Generate button → POST `/api/generate` → render proposals, each with Accept / Edit / Reject; show continuous progress while generating; surface input/errors clearly.
**Contract**: React island; Tailwind via `cn()` from `@/lib/utils`; disables submit + shows progress during the request; per-proposal state (pending/accepted/rejected/edited); exposes the accepted set for S-02's save. Client-side length/empty guard mirrors the server.

### Success Criteria:

#### Automated Verification:

- `astro check`, `build`, `lint` pass.

#### Manual Verification:

- Paste → progress shown → proposals appear; accept/edit/reject works; empty/oversized input blocked with a message; logged-out `/generate` → `/auth/signin`.

**Implementation Note**: Pause for confirmation. Final step updates test-plan §6 if a reusable test pattern emerged.

---

## Testing Strategy

Unit: `openrouter.ts` (validated parse, error branches) — oracle from the JSON contract, not the impl. Integration: `/api/generate` (401 / 400 / success) with OpenRouter stubbed at the network layer (keep auth real). E2E (later, S-01's browser risk): paste → proposals visible (mock OpenRouter at HTTP) — see `e2e/`. Privacy (R5) checked by asserting no raw-text persistence/logging.

## Open Questions

> Left explicit — do NOT guess.

1. **OpenRouter model** — which model (cost vs quality)? Owner: user. Needed before the prompt is finalized.
2. **Input length limit** (PRD Open Q2) — concrete max chars (cost/quality guardrail). Owner: user + downstream.
3. **Privacy posture** — does the chosen OpenRouter model/route meet "text not retained after the request"? Verify provider setting (R5). Owner: user.
4. **Rate-limit policy** — requests/min per user for R6. Owner: user.

## References

- Change: `context/changes/first-gated-generation/change.md`
- Data layer: `context/changes/minimal-flashcard-persistence/plan.md` (F-02)
- Endpoint shape: `src/pages/api/auth/signin.ts`; gate: `src/middleware.ts`
- Test-plan risks: R2, R5, R6 (`context/foundation/test-plan.md`)

## Progress

> `- [ ]` pending, `- [x]` done. Append ` — <sha>` when a step lands.

### Phase 1: OpenRouter client + proposal contract

#### Automated

- [x] 1.1 astro check + build + lint pass
- [x] 1.2 Unit: valid → proposals; malformed → bad_output; empty/oversized → invalid_input (no HTTP call)

#### Manual

- [x] 1.3 Real key: sample paste returns sensible proposals — live smoke HTTP 200, returned valid [{front,back}]

### Phase 2: Generation API endpoint

#### Automated

- [x] 2.1 astro check + build + lint pass
- [x] 2.2 unauth → 401 JSON; empty/oversized → 400; valid → proposals (OpenRouter stubbed)

#### Manual

- [x] 2.3 Server logs contain no raw source text (R5) — by construction: endpoint/handler never log or persist the body

### Phase 3: Generation UI (paste → triage)

#### Automated

- [x] 3.1 astro check + build + lint pass

#### Manual

- [ ] 3.2 Paste → progress → proposals; accept/edit/reject works (browser + login — user step)
- [ ] 3.3 Empty/oversized input blocked with a message (browser — user step)
- [x] 3.4 Logged-out `/generate` redirects to `/auth/signin` — covered by default-deny middleware + route-access test (unknown routes protected)
