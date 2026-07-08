# Gate product routes (F-01) — Plan Brief

> Full plan: `context/changes/gate-product-routes/plan.md`

## What & Why

Make every route login-gated by default, with an explicit public allowlist, so no product surface is ever reachable without a session. This is roadmap foundation F-01 — it enforces the PRD data-isolation guardrail and unlocks S-01 (the generation loop must run under a real user session).

## Starting Point

`src/middleware.ts` protects only `/dashboard` via an opt-in `PROTECTED_ROUTES` list. `context.locals.user` is already resolved on every request. `/` shows the starter `Welcome` page; `/dashboard` is the only product route today.

## Desired End State

Any route not on the public allowlist (`/`, `/auth/*`, `/api/auth/*`, static assets) redirects unauthenticated users to `/auth/signin` — future product routes are protected with zero middleware edits. Authenticated users hitting `/` are redirected to `/dashboard`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gating strategy | Default-deny (public allowlist) | New product routes are protected automatically — safe default matching the PRD guardrail | Plan |
| Landing for authed users | Redirect `/` → `/dashboard` | Logged-in users go straight to the product; landing is for logged-out visitors | Plan |
| Auth provider | Keep email/password | SSO is a non-blocking Open Roadmap Question | Roadmap |

## Scope

**In scope:** default-deny gate in middleware; public allowlist incl. static-asset passthrough; authed `/` → `/dashboard` redirect.

**Out of scope:** richer landing copy; federated SSO; redirecting authed users off `/auth/*`; admin/role gating.

## Architecture / Approach

Single choke point: `src/middleware.ts`. After resolving `context.locals.user`, classify the path via a public-route predicate; protected + unauthenticated → redirect to `/auth/signin`. Then a one-line authed-landing redirect. All logic in one file.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Default-deny gating | Everything protected except the allowlist | Over-broad match redirecting static assets → redirect loop / broken styling |
| 2. Authed landing redirect | Logged-in `/` → `/dashboard` | Redirect loop if dashboard/landing misclassified |

**Prerequisites:** none (F-01 is `ready`; auth baseline present).
**Estimated effort:** ~1 short session, 2 phases, one file.

## Open Risks & Assumptions

- Static-asset requests must bypass the gate on the Cloudflare adapter — the allowlist covers `/_astro/*` and extension-bearing paths; verify no redirect loop on styled pages.
- Assumes email/password auth stays for MVP (SSO deferred).

## Success Criteria (Summary)

- Logged out: every non-public route (incl. made-up product paths) redirects to `/auth/signin`; public pages + assets load.
- Auth flow still completes end-to-end.
- Logged in: `/` lands on `/dashboard`; no redirect loops.
