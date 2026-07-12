# Test rollout Phase 1 — auth-gate guard (R3) Implementation Plan

## Overview

Bootstrap the test runner (none exists) and add the first regression guard for **R3** (auth-gate regression): the default-deny allowlist that decides which routes are public vs login-protected. Cheapest real signal = a unit test of the pure allowlist policy, with its oracle taken from the design contract, not the code.

## Current State Analysis

- No test runner (`vitest` not installed, no `test` script, 0 test files). Per `context/foundation/test-plan.md` §4.
- `src/middleware.ts` holds `isPublicRoute` (pure, **not exported**) + `onRequest` gating. Grounded in `research.md`.
- Middleware imports `astro:middleware` and (transitively) `astro:env/server`; `getViteConfig` from `astro/config` resolves those + the `@/*` alias.

## Desired End State

`npm test` runs Vitest green. A unit suite asserts the allowlist contract: `/`, `/auth/*`, `/api/auth/*`, and static assets are public; `/dashboard` and unknown product routes (`/deck`, `/generate`, `/review`, `/api/generate`) are protected by default. Loosening the allowlist (or dropping a public entry) makes the suite fail.

### Key Discoveries:

- Extract the pure policy to `src/lib/route-access.ts` so it's testable without `astro:*` or mocks (research.md).
- Oracle = design contract (default-deny), not current return values.

## What We're NOT Doing

- Not testing `onRequest` redirect wiring / Supabase (deferred Phase 3; needs context+client mocks, incremental signal).
- Not adding CI mutation testing here (later).
- Not changing gating behavior — the extraction is behavior-preserving.

## Phase 1: Test-runner bootstrap

### Overview

Stand up Vitest so the project can run tests at all.

### Changes Required:

**File**: `package.json` — **Intent**: add `vitest` devDep + `"test": "vitest run"` script. **Contract**: `npm test` exits 0 on a passing suite.

**File**: `vitest.config.ts` — **Intent**: configure Vitest via Astro so `astro:*` and `@/*` resolve. **Contract**: uses `getViteConfig` from `astro/config`.

**File**: `src/lib/route-access.smoke.test.ts` (temporary) — **Intent**: a trivial `expect(true).toBe(true)` to prove the runner works. **Contract**: removed or replaced in Phase 2.

### Success Criteria:

#### Automated Verification:

- `npm test` runs and passes.
- Lint passes: `npm run lint`.

#### Manual Verification:

- Runner discovers and executes the test file (visible in output).

**Implementation Note**: Pause for confirmation before Phase 2.

---

## Phase 2: Allowlist regression guard

### Overview

Extract the pure policy and assert the R3 contract.

### Changes Required:

**File**: `src/lib/route-access.ts` — **Intent**: export `isPublicRoute(pathname)` (and the allowlist constants) moved verbatim from `middleware.ts`. **Contract**: same classification as today (behavior-preserving).

**File**: `src/middleware.ts` — **Intent**: import `isPublicRoute` from `@/lib/route-access` instead of the local copy. **Contract**: no behavior change; `astro check`/build stay green.

**File**: `src/lib/route-access.test.ts` — **Intent**: assert the allowlist contract. **Contract**: public → `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/api/auth/signin`, `/_astro/x.js`, `/favicon.png`; protected → `/dashboard`, `/deck`, `/generate`, `/review`, `/api/generate`. Include the default-deny case (an invented route) explicitly. Behavioral assertions on concrete paths, not on how the predicate is built.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the allowlist suite.
- `npx astro check` + `npm run build` pass (refactor didn't break middleware).
- Lint passes.

#### Manual Verification:

- Deliberate-break check: temporarily add `/deck` to the public allowlist → the "protected by default" test FAILS. Revert.

**Implementation Note**: Pause for confirmation. Final step updates `test-plan.md` §6 cookbook + §3 Phase 1 status.

---

## Testing Strategy

Unit only this change (pure policy). Deliberate-break verification per Phase 2 (poor-man's mutation test): loosen the allowlist, confirm a test goes red.

## References

- `context/changes/testing-auth-gating/research.md`
- `context/foundation/test-plan.md` §2 R3
- `src/middleware.ts:1-41`

## Progress

> `- [ ]` pending, `- [x]` done. Append ` — <sha>` when a step lands.

### Phase 1: Test-runner bootstrap

#### Automated

- [x] 1.1 `npm test` runs and passes
- [x] 1.2 Lint passes

#### Manual

- [x] 1.3 Runner discovers & executes the test file

### Phase 2: Allowlist regression guard

#### Automated

- [x] 2.1 `npm test` passes with the allowlist suite
- [x] 2.2 `npx astro check` + `npm run build` pass
- [x] 2.3 Lint passes

#### Manual

- [x] 2.4 Deliberate-break: adding `/deck` to public makes a test fail; reverted
- [x] 2.5 test-plan.md §6 cookbook + §3 Phase 1 status updated
