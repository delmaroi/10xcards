---
date: 2026-07-08
researcher: /10x-research (2 parallel Explore subagents)
git_commit: d34459a
branch: main
repository: 10xCards
topic: "Current 10xCards state relevant to building the SRS review session (S-05)"
tags: [research, codebase, srs, review-session, s-04, supabase, ts-fsrs]
status: complete
last_updated: 2026-07-08
last_updated_by: /10x-research
---

# Research: SRS review session (S-05) — current codebase state

**Date**: 2026-07-08
**Git Commit**: d34459a
**Branch**: main
**Repository**: 10xCards

## Research Question

What in 10xCards today is relevant to building a spaced-repetition review session (S-05): what flashcard/deck data model and persistence exists, how the user session/auth flow works, where a review feature would integrate (routes, API, middleware, data-access conventions), and whether `ts-fsrs` (Node ≥20) fits the stack?

## Summary

10xCards is currently **auth + UI scaffolding only**. There is **no flashcard/deck data model, no persistence, and no SRS dependency** — S-05's hard prerequisites (F-02 flashcard persistence, S-01/S-02 generation + save-to-deck) are not built yet. What _is_ solid and reusable: the Supabase SSR auth flow, the default-deny middleware (from the just-shipped `gate-product-routes`), the API-endpoint convention, and the `@/*` import + `astro:env/server` secret conventions. The stack is compatible with the chosen library (`ts-fsrs`, Node ≥20; repo runs 22.14.0). Net: S-05 is **plannable now** (the contract is known from the F-03 spike), but **not implementable** until F-02 → S-01 → S-02 land.

## Detailed Findings

### Data & persistence — ABSENT (the blocking gap)

- No migrations: `supabase/` holds only `config.toml` + `.gitignore`; `supabase/config.toml` shows an empty migration list. No `supabase/migrations/`.
- No `supabase.from(...)` table reads/writes anywhere in `src/`.
- No domain types — no `src/types.ts`, no Flashcard/Deck/Card definitions.
- `src/pages/dashboard.astro:1-27` is an auth skeleton only (no card models).
- `package.json` lists no `ts-fsrs`/`fsrs`/SRS scheduler; deps are Astro 6, React, Tailwind, `@supabase/ssr`, `@supabase/supabase-js`.

### Auth / session flow — PRESENT and reusable

- `src/middleware.ts:19-46` — `onRequest` sets `context.locals.user` via `supabase.auth.getUser()`; default-deny gating redirects unauthenticated users to `/auth/signin`; public allowlist = `/`, `/auth/*`, `/api/auth/*`, static assets (shipped in `gate-product-routes`, commit d34459a).
- `src/lib/supabase.ts:5-24` — `createClient(requestHeaders, cookies)` is the single server-client factory (SSR cookie handling); secrets from `astro:env/server`.

### Integration points — where S-05 would plug in

- **Pages** are feature-organized under `src/pages/` (`/auth/`, `/api/auth/`); a page reads the user via `Astro.locals.user` (`dashboard.astro:4`).
- **API endpoint reference shape**: `src/pages/api/auth/signin.ts:4-20` — `export const POST: APIRoute`, reads `context.request.formData()`, `createClient(context.request.headers, context.cookies)`, responds via redirect with error handling.
- **Natural homes for S-05** (following conventions): a protected page `src/pages/review.astro` (middleware auto-gates it under default-deny) and a rating-submission endpoint `src/pages/api/review/submit-rating.ts` (POST; user from `context.locals.user`; Supabase client via the factory).

### Stack compatibility with `ts-fsrs`

- `.nvmrc` = `22.14.0`, `ts-fsrs` requires Node ≥20 → **compatible**. TS/ESM matches the Astro stack. (Library choice + API contract: see F-03 spike below.)

## Code References

- `src/middleware.ts:19-46` — auth resolution + default-deny gating (review page auto-gated).
- `src/lib/supabase.ts:5-24` — server Supabase client factory.
- `src/pages/api/auth/signin.ts:4-20` — API endpoint reference shape for the rating endpoint.
- `src/pages/dashboard.astro:4` — reading `Astro.locals.user` in a protected page.
- `astro.config.mjs:18-21` — server-only secret schema; `tsconfig.json:10` — `@/*` alias.
- `supabase/config.toml` — empty migration list (no schema yet).
- `package.json` / `.nvmrc` — deps + Node 22.14.0.

## Architecture Insights

- **The only real blocker is the data layer.** S-05 is a thin vertical on top of a flashcard table that does not exist. The `review_state` (a `ts-fsrs` `Card` object as JSON) rides on the flashcard row that F-02 must create.
- **Auth/gating is a solved substrate.** A new `/review` page needs no gating work — default-deny covers it automatically (dogfoods the `gate-product-routes` win).
- **Convention is consistent and cheap to follow.** One client factory, one API shape, `@/*` imports, `astro:env/server` secrets — the plan can cite these instead of inventing patterns.

## Historical Context (from prior changes)

- `context/changes/srs-library-spike/research.md` — F-03 external-research spike: **choose FSRS via `ts-fsrs`**; contract = store the `Card` object (from `createEmptyCard`, updated via `scheduler.next(card, now, rating).card`) as JSON; ratings `Again/Hard/Good/Easy`; "due today" = `review_state.due <= now`.
- `context/changes/gate-product-routes/plan.md` — default-deny middleware (commit d34459a) that will auto-gate the review page.
- `context/foundation/roadmap.md` — S-05 (this slice, `blocked`), prerequisites S-02 + F-03; F-02 is the data-layer foundation.

## Related Research

- `context/changes/srs-library-spike/research.md` — the SRS library/API spike (external research).

## Open Questions

1. **Edit-vs-reset policy** — when a card's front/back is edited, does its `ts-fsrs` review state reset or persist? (From F-03 spike; decide in the S-05 plan.) Owner: user.
2. **Where the `flashcard` table + `review_state` column are defined** — belongs to F-02; S-05 assumes it. Owner: F-02 plan.
3. **Model parameters** — default `fsrs()` params for MVP vs per-user optimized params. Owner: user.
4. **"Today" boundary / timezone** for due-date comparison. Owner: downstream plan.
