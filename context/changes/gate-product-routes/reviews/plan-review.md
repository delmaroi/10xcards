<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Gate product routes (F-01)

- **Plan**: context/changes/gate-product-routes/plan.md
- **Mode**: Deep
- **Date**: 2026-07-08
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
4/4 paths ✓, 3/3 symbols ✓ (PROTECTED_ROUTES, context.locals.user, createClient), brief↔plan ✓. Only `/api/auth/*` product API endpoints exist today.

## Findings

### F1 — Default-deny 302-redirects future product /api/* instead of 401

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — concerns a downstream slice, not F-01
- **Dimension**: Blind Spots
- **Location**: Phase 1 — public-route predicate
- **Detail**: After default-deny, future unauthenticated product `/api/*` calls (e.g. S-01's generation endpoint) will 302-redirect to `/auth/signin` instead of returning 401 JSON. Not an F-01 defect (only `/api/auth/*` exists today, which is public), but S-01 must return proper 401s for product API routes.
- **Fix**: Note in plan "What We're NOT Doing" that API 401 handling is S-01's concern.
- **Decision**: FIXED (added out-of-scope note to plan)

### F2 — `npx astro check` may need a prior `astro sync`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick, obvious
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Automated Verification
- **Detail**: No `check` script in package.json; CI runs `npx astro sync` before check/build. Locally, `astro check` without a prior sync can report missing generated types.
- **Fix**: Use `npx astro sync && npx astro check` in the success criteria.
- **Decision**: FIXED (updated plan Phase 1 automated criterion + Progress 1.1)
