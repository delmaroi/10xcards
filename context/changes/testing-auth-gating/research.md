---
topic: "Guard the auth gate (R3) — cheapest test layer + infra needs"
researcher: /10x-research (inline; grounded by code read + Astro testing docs)
date: 2026-07-09
change_id: testing-auth-gating
risk: R3 (auth-gate regression)
---

# Research: guarding the auth gate (R3)

## Where the risk passes through code

- `src/middleware.ts` — the single gating choke point. `isPublicRoute(pathname)` (line 9, **pure, not exported**) decides public vs protected via an allowlist: exact `/`, prefixes `/auth/`, `/api/auth/`, and static assets (`/_astro/` or a path whose last segment has a `.`). `onRequest` (line 19) redirects unauthenticated requests to non-public routes to `/auth/signin`, and redirects authenticated `/` → `/dashboard`.
- The R3 failure surface is the **allowlist correctness**: if someone adds a product route to the public list, widens a prefix, or a new route type slips the classification, unauthenticated users reach product surface. Default-deny means _unknown_ routes must be protected.

## The oracle (independent of implementation)

From the design contract (test-plan R3 + `gate-product-routes` plan), NOT from the code's current returns:

- **Public** (no session): `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/api/auth/*`, static assets.
- **Protected** (session required): `/dashboard`, and every **not-yet-existing product route** — `/deck`, `/generate`, `/review`, `/api/generate` — must be protected _by default_. This is the load-bearing guarantee: a future product route is gated without a middleware edit.

Asserting `/deck` (a route that doesn't exist yet) is protected is the behavioral test that kills the real regression: a loosened allowlist.

## Cheapest test layer (cost × signal)

- **Extract the pure policy** `isPublicRoute` into `src/lib/route-access.ts` (behavior-preserving refactor; middleware imports it). Then a **plain unit test** asserts the allowlist contract with no `astro:*` resolution, no mocks, no DB — the cheapest possible real signal for R3's core.
- Deferred (Phase 2, optional): full `onRequest` redirect behavior (mock Astro context + Supabase client) — more setup for incremental signal. Not needed to guard the allowlist regression.

## Test infra needs

- No runner today. Bootstrap **Vitest** (native to the Vite/Astro toolchain). Add `vitest.config.ts` using `getViteConfig` from `astro/config` — it resolves `astro:*` virtual modules and the `@/*` path alias automatically (Astro testing docs), so it's ready for Phase 2 integration tests too. Add a `test` script.
- Node ≥20 satisfied (22.14.0).

## Anti-patterns to avoid (this change)

- **Oracle problem**: don't assert "isPublicRoute('/deck') === false because that's what it returns." Assert it because the _contract_ says unknown product routes are protected.
- **Mirror**: don't test how the predicate is built (prefix loop, `.includes`); test the observable classification of concrete paths.
- **Mutation-awareness**: the suite should fail if the allowlist is loosened (e.g., `/deck` becomes public) or a public entry is dropped (e.g., `/auth/signin` becomes protected → login deadlock).

## Sources

- `src/middleware.ts:1-41` (code read).
- [Astro Testing docs — getViteConfig / Vitest](https://docs.astro.build/en/guides/testing/).
- `context/foundation/test-plan.md` §2 R3 + Risk Response Guidance.
- `context/changes/gate-product-routes/plan.md` (the gate's design contract).
