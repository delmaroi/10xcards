# Gate product routes (F-01) Implementation Plan

## Overview

Flip route protection from an opt-in "protected list" to a default-deny model: every route is behind login **except** an explicit public allowlist (landing, auth pages, auth API, static assets). Additionally, redirect already-authenticated visitors away from the landing page into the product. This is roadmap foundation F-01, which unlocks S-01 (the generation loop must run under a real session before it can save "my" cards).

## Current State Analysis

- `src/middleware.ts` gates only `PROTECTED_ROUTES = ["/dashboard"]`. Any new product route (future `/generate`, `/deck`, `/review`) ships **unprotected by default** — a data-isolation footgun against the PRD guardrail "nothing reachable without a session".
- `context.locals.user` is already resolved on every request via the Supabase SSR client (`src/lib/supabase.ts`), so the identity signal the gate needs is present.
- `/` (`src/pages/index.astro`) renders the starter `Welcome` component — a public page. `/dashboard` is the only current product route.
- Unauthenticated hits on a protected route already redirect to `/auth/signin`.
- Auth flow endpoints live at `/api/auth/{signin,signup,signout}` and auth pages at `/auth/{signin,signup,confirm-email}` — these MUST stay reachable without a session or the login flow deadlocks.

## Desired End State

Any route not on the public allowlist redirects unauthenticated users to `/auth/signin`. The public allowlist is: `/` (landing), `/auth/*` (auth pages), `/api/auth/*` (auth endpoints), and static assets (`/_astro/*`, files with an extension). New product routes are protected automatically with no middleware edit. An authenticated user visiting `/` is redirected to `/dashboard`.

Verify: log out, hit `/dashboard` and a made-up `/deck` → both redirect to `/auth/signin`; hit `/`, `/auth/signin`, `/auth/signup` → all render. Log in, hit `/` → land on `/dashboard`; hit `/dashboard` → see it. CSS/JS load without a redirect loop.

### Key Discoveries:

- `src/middleware.ts:4` — the single choke point; all gating logic lives here.
- `src/lib/supabase.ts:6-8` — `createClient` returns `null` when env secrets are missing; middleware already handles the null case (treats user as unauthenticated). Keep that behavior.
- Static assets on the Cloudflare adapter are served via the `ASSETS` binding; the middleware must not redirect asset requests (would break styling / cause loops).

## What We're NOT Doing

- Not building a richer marketing landing page — the existing `Welcome` stays as the public landing (copy polish is parked).
- Not adding federated SSO — email/password baseline stays (Open Roadmap Question, non-blocking).
- Not redirecting authenticated users away from `/auth/*` (minor UX nicety; out of scope for this foundation).
- Not adding role-based (admin) gating — Access Control's admin surface is not part of F-01.
- Not handling API-style auth failures — with default-deny, future unauthenticated product `/api/*` calls (e.g. S-01's generation endpoint) will 302-redirect to `/auth/signin` rather than return 401 JSON. Returning proper 401s for product API routes is S-01's concern, not F-01's (today only `/api/auth/*` exists, which is public).

## Implementation Approach

Rewrite the gate in `src/middleware.ts` as default-deny: after resolving `context.locals.user`, classify the request path as public or protected via an allowlist helper; redirect unauthenticated requests to protected paths. Then add a single authenticated-landing redirect. Both behaviors are in one file; split into two phases so each is independently verifiable.

## Phase 1: Default-deny route gating

### Overview

Replace the `PROTECTED_ROUTES` opt-in with a public allowlist so everything is protected unless explicitly public.

### Changes Required:

#### 1. Middleware gating logic

**File**: `src/middleware.ts`

**Intent**: Invert the gate. Keep resolving `context.locals.user` exactly as today, then treat the request as protected unless its path matches the public allowlist; unauthenticated + protected → redirect to `/auth/signin`. Static-asset requests must pass through untouched.

**Contract**: Introduce a public-route predicate. Public = path `/` OR starts with `/auth/` OR starts with `/api/auth/` OR is a static asset (starts with `/_astro/` or the last path segment contains a `.`). Non-public paths require `context.locals.user`; if absent, redirect to `/auth/signin`. Preserve the existing `createClient` null-guard (missing secrets → user null → protected routes redirect). Remove the `PROTECTED_ROUTES` constant.

### Success Criteria:

#### Automated Verification:

- Type/astro check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Logged out: visiting `/dashboard` redirects to `/auth/signin`.
- Logged out: visiting a made-up product path (e.g. `/deck`) redirects to `/auth/signin`.
- Logged out: `/`, `/auth/signin`, `/auth/signup` all render (no redirect).
- Static assets (CSS/JS) load on public pages — no redirect loop, styling intact.
- Auth flow still works end-to-end: sign in succeeds (auth API reachable).

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Authenticated landing redirect

### Overview

Send already-authenticated visitors from the landing page straight into the product.

### Changes Required:

#### 1. Landing redirect in middleware

**File**: `src/middleware.ts`

**Intent**: When an authenticated user requests `/`, redirect to `/dashboard` so the landing is effectively for logged-out/new visitors only.

**Contract**: After the gate logic, if `context.url.pathname === "/"` and `context.locals.user` is present, `return context.redirect("/dashboard")`. Must run after user resolution and must not affect logged-out users (they still see the landing).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Logged in: visiting `/` redirects to `/dashboard`.
- Logged out: visiting `/` still renders the landing (no redirect).
- Logged in: visiting `/dashboard` still renders the dashboard (no loop).

**Implementation Note**: After automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Manual Testing Steps:

1. Logged out → `/dashboard` → expect redirect to `/auth/signin`.
2. Logged out → `/deck` (nonexistent product path) → expect redirect to `/auth/signin`.
3. Logged out → `/`, `/auth/signin`, `/auth/signup` → expect all render, assets load.
4. Sign in → expect success (auth API not gated).
5. Logged in → `/` → expect redirect to `/dashboard`.
6. Logged in → `/dashboard` → expect render, no loop.

(The starter ships no unit-test harness; verification is lint + build + manual. Adding a test runner is out of scope for this foundation.)

## References

- Roadmap item: `context/foundation/roadmap.md` (F-01)
- Change identity: `context/changes/gate-product-routes/change.md`
- Gate choke point: `src/middleware.ts:4-25`
- Auth client: `src/lib/supabase.ts:5-24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Default-deny route gating

#### Automated

- [x] 1.1 Type/astro check passes: `npx astro sync && npx astro check` — c7fc635
- [x] 1.2 Lint passes: `npm run lint` — c7fc635
- [x] 1.3 Build passes: `npm run build` — c7fc635

#### Manual

- [x] 1.4 Logged out: `/dashboard` redirects to `/auth/signin` — c7fc635
- [x] 1.5 Logged out: made-up product path (e.g. `/deck`) redirects to `/auth/signin` — c7fc635
- [x] 1.6 Logged out: `/`, `/auth/signin`, `/auth/signup` render (no redirect) — c7fc635
- [x] 1.7 Static assets load on public pages — no redirect loop — c7fc635
- [x] 1.8 Auth flow still works end-to-end (sign in succeeds) — c7fc635

### Phase 2: Authenticated landing redirect

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — e7e7986
- [x] 2.2 Build passes: `npm run build` — e7e7986

#### Manual

- [x] 2.3 Logged in: `/` redirects to `/dashboard` — e7e7986
- [x] 2.4 Logged out: `/` still renders the landing — e7e7986
- [x] 2.5 Logged in: `/dashboard` renders (no loop) — e7e7986
