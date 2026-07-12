# Google OAuth sign-in (SSO) Implementation Plan

## Overview

Add Google federated SSO via Supabase OAuth, alongside the existing email/password auth, closing the FR-001 gap (PRD asks for SSO / no product-stored passwords). Provider = Google (roadmap Open Q5).

## Current State Analysis

- Email/password auth shipped: `src/pages/api/auth/{signin,signup,signout}.ts` use the SSR client (`src/lib/supabase.ts`) and redirect on result. Middleware default-deny gates product routes; `/api/auth/*` is public (`src/lib/route-access.ts`).
- The SSR client uses `@supabase/ssr` cookie adapters — so the PKCE code-verifier cookie set during OAuth init is readable at the callback.

## Desired End State

"Continue with Google" on the signin + signup pages starts the OAuth flow; after Google consent the user lands authenticated on `/dashboard`. Email/password remains fully functional. OAuth routes are public (under `/api/auth/`).

Verify (after Supabase+Google config): click Continue with Google → Google consent → back to `/dashboard`, logged in; `Astro.locals.user.email` is the Google account.

## What We're NOT Doing

- **Not removing email/password** — SSO is additive (inclusivity: students without Google).
- **No other providers** (GitHub, etc.) — Google only for MVP.
- **No account-linking UI** — Supabase links by email automatically per its provider settings.

## Critical Implementation Details

- OAuth init must run server-side through the SSR client so the PKCE verifier is written to cookies; the callback exchanges the `code` for a session using those cookies.
- `redirectTo` = `${origin}/api/auth/callback` — the app callback (Supabase's own `/auth/v1/callback` is the Google redirect URI, configured in the dashboard).

## Phase 1: OAuth endpoints + UI

### Changes Required:
#### 1. OAuth init
**File**: `src/pages/api/auth/google.ts`
**Intent**: `GET` — `signInWithOAuth({ provider: "google", options: { redirectTo } })`, redirect to `data.url`. Errors → `/auth/signin?error=`.

#### 2. Callback
**File**: `src/pages/api/auth/callback.ts`
**Intent**: `GET` — read `code`, `exchangeCodeForSession(code)`, redirect `/dashboard`; missing code / error → `/auth/signin?error=`.

#### 3. UI buttons
**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`
**Intent**: A divider + "Continue with Google" anchor to `/api/auth/google` under each form.

### Success Criteria:
#### Automated:
- `npx astro check` (0 errors); `npm run lint`; `npm run build`.
#### Manual (needs Supabase+Google config):
- Continue with Google → consent → `/dashboard` authenticated.
- Missing/failed code → signin with an error message.
- Email/password still works.

## References
- Endpoint pattern: `src/pages/api/auth/signin.ts`; SSR client: `src/lib/supabase.ts`
- Public routing: `src/lib/route-access.ts` (`/api/auth/` prefix)
- PRD FR-001; roadmap Open Q1/Q5

## Progress

> `- [ ]` pending, `- [x]` done. Append ` — <sha>`.

### Phase 1: OAuth endpoints + UI
#### Automated
- [x] 1.1 astro check passes (0 errors)
- [x] 1.2 lint passes
- [x] 1.3 build passes
#### Manual (needs Supabase + Google Cloud config)
- [ ] 1.4 Continue with Google → consent → /dashboard authenticated
- [ ] 1.5 Missing/failed code → signin with error; email/password still works
