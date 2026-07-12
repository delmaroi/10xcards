# First gated AI generation loop (S-01) — Plan Brief

> Full plan: `context/changes/first-gated-generation/plan.md`

## What & Why

The product wedge: a logged-in user pastes text, an LLM (OpenRouter) proposes flashcards, and the user accepts / edits / rejects each. Roadmap S-01 (PRD US-01, FR-005, FR-006) — the first real LLM integration and where the ≥75% acceptance metric starts.

## Starting Point

F-02 gives the `flashcards` table (persistence handled by S-02, not here). No LLM integration exists. Auth, default-deny gating, the API pattern, and `cn()`/`@/*`/`astro:env` conventions are reusable.

## Desired End State

At `/generate`, paste text → progress shown → AI proposals listed, each Accept/Edit/Reject. Accepted set is ready for S-02 to persist. Empty/too-short/too-long input is rejected. Raw text is never persisted or logged.

## Key Decisions Made

| Decision          | Choice                                          | Why                                                    | Source         |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------ | -------------- |
| Draft persistence | Ephemeral (client-side triage)                  | Only accepted cards persist (S-02); keeps S-01 focused | F-02 plan      |
| LLM transport     | Plain `fetch` to OpenRouter                     | Works on Workers edge; no Node SDK                     | Plan           |
| Output contract   | Strict JSON `{front,back}[]` validated with zod | Don't trust LLM output; project uses zod on APIs       | Plan           |
| API auth failure  | 401 JSON (not 302)                              | API callers need a status, not an HTML redirect        | F-01 plan note |
| Privacy           | Endpoint retains/logs nothing                   | Guardrail R5                                           | test-plan      |

## Scope

**In scope:** `openrouter.ts` client (validated proposals), `OPENROUTER_KEY` secret, `/api/generate` endpoint (auth + limits + privacy), `/generate` page + triage island.

**Out of scope:** persisting cards (S-02), manual create / bulk-accept, SRS, optimized model params.

## Architecture / Approach

`openrouter.ts` → validated proposals; `/api/generate` (gated, 401-JSON, length/rate limits, zod, no retention) → JSON; `/generate` page + React island for paste → progress → per-proposal triage. Accepted set handed to S-02.

## Phases at a Glance

| Phase                           | What it delivers                          | Key risk                                         |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| 1. OpenRouter client + contract | Text → validated `{front,back}` proposals | Trusting malformed LLM output (mitigated by zod) |
| 2. Generation API               | Gated, privacy-safe `/api/generate`       | Raw text leaking to logs/DB (R5)                 |
| 3. Generation UI                | Paste → progress → accept/edit/reject     | Frozen UI during slow generation (NFR progress)  |

**Prerequisites:** F-02 migration applied; an **OpenRouter API key**; a decided model + input-length limit. **S-01 cannot be implemented until these land.**
**Estimated effort:** ~2 sessions, 3 phases.

## Open Risks & Assumptions

- Blocked on OpenRouter key + model/limit decisions (see plan Open Questions 1–4).
- Assumes F-02's `flashcards` table exists for the S-02 handoff.
- Privacy depends on the chosen provider route retaining nothing — must be verified (R5).

## Success Criteria (Summary)

- Paste → proposals with visible progress; accept/edit/reject each.
- Empty/oversized input rejected client- and server-side; unauth API → 401 JSON.
- No raw source text persisted or logged.
