---
project: 10xCards
created: 2026-07-08
test_base: none
main_goal_alignment: speed (per roadmap main_goal)
---

# Test Plan — 10xCards

> Risk-based QA rollout. This is a living document: §3 tracks rollout state, §6 fills in as phases ship.
> Managed by `/10x-test-plan`. Run `/10x-test-plan --status` to see where the rollout stands.

## 1. Strategy

1. **Cost × signal.** Every test must answer: _what is the cheapest test that gives a real signal for this risk?_ Don't promote to e2e because it "feels safer"; don't layer AI-native checks over a deterministic test that already catches the regression.
2. **User concerns are evidence.** Risks the developer has lived through (the Phase 2 interview) carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations (signal, not knowledge).** This plan names _what user-visible behavior must be protected_ and _why we believe it's at risk_ — never "the bug is in file X:line Y." Code anchors are `/10x-research`'s job, produced per rollout phase against current code. The §2 Source column cites evidence (PRD lines, interview answers, hot-spot directories), never a file.
4. **The oracle rule.** A test's expected value must come from an independent source (PRD, contract, interview, domain rule) — never from the implementation under test. An assertion copied from what the code currently returns is tautological: it green-lights current bugs and can never fail for the right reason.

## 2. Risk Map

Scored on a coarse High / Medium / Low scale. Protect High × High first. Source = evidence that raised the risk, not a code anchor.

| #   | Risk (user-visible failure scenario)                                                            | Impact   | Likelihood | Source (evidence)                                                                      |
| --- | ----------------------------------------------------------------------------------------------- | -------- | ---------- | -------------------------------------------------------------------------------------- |
| R1  | User A can read or rate User B's flashcards (IDOR / RLS gap)                                    | High     | High       | Interview Q1+Q2; PRD Access Control + guardrail "pełna izolacja danych między kontami" |
| R2  | A rejected/pending AI draft leaks into the deck, or accept/reject is mishandled                 | High     | High       | Interview Q3; PRD FR-006/FR-007; roadmap S-01/S-02 (product wedge)                     |
| R3  | Auth-gate regression: unauthenticated user reaches product, or authenticated user is locked out | High     | Med–High   | Hot-spot `src/middleware.ts` (top churn, 3 commits/30d); PRD FR-001/FR-002             |
| R4  | Accepted cards are lost on save (non-atomic save-to-deck)                                       | High     | Med        | PRD guardrail "brak utraty danych"; roadmap S-02 (atomic-save)                         |
| R5  | Pasted source text leaks or is retained after the request in the LLM path                       | High     | Med        | PRD guardrail (privacy) + NFR; `infrastructure.md` risk register                       |
| R6  | [abuse] No rate-limit → looped costly LLM generation (cost blow-up / DoS)                       | Med–High | Med        | Abuse lens (resource abuse); PRD FR-005 + `has_ai`                                     |

### Risk Response Guidance

| #   | What would prove protection                                                                                 | Must challenge                                                                   | Context /10x-research must ground                                                        | Likely cheapest layer                                                                  | Anti-pattern to avoid                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| R1  | A request as User A for User B's card is denied (no read, no rate write)                                    | "Logged-in" ≠ "owns this resource"; RLS assumed correct but never exercised      | Where card ownership is enforced (RLS policy vs app check); the card-access entry points | Integration test (two users, cross-access)                                             | Testing only the happy path (own cards); over-mocking the DB so RLS is never exercised |
| R2  | Only human-accepted drafts land in the deck; rejected/pending never do                                      | "Accept saved it" — verify persisted set equals accepted set exactly             | The draft state machine + the save boundary                                              | Unit (draft-state transitions) + integration (save)                                    | Oracle problem: asserting whatever the save function currently writes                  |
| R3  | Logged-out hitting any non-public route redirects to sign-in; logged-in reaches product; static/public pass | New product routes are gated by default (allowlist correctness)                  | The middleware allowlist + redirect behavior                                             | Integration test on route gating (mirror the manual checks from `gate-product-routes`) | Snapshotting middleware output; asserting on implementation instead of HTTP behavior   |
| R4  | All accepted drafts persist together or none (atomicity); reload shows them                                 | "Returned 200" ≠ "all rows committed"                                            | The save transaction boundary + failure path                                             | Integration test (partial-failure → nothing committed)                                 | Happy-path-only; asserting count without simulating a mid-save failure                 |
| R5  | Raw source text is not persisted anywhere readable after the response                                       | "Provider has a privacy mode" — verify the app itself doesn't store the raw text | The generation request path + what it writes/logs                                        | Contract/integration (assert no raw-text persistence)                                  | Trusting provider marketing; asserting on the LLM output instead of on retention       |
| R6  | A burst of generation requests is throttled / bounded by input length                                       | "Client validates length" — server must enforce it too                           | Where generation is triggered; any limit enforcement                                     | Integration test (burst / oversized input rejected)                                    | Testing client-side validation only; assuming the endpoint is cheap                    |

## 3. Phased Rollout

Status vocabulary: `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

| #   | Phase                                     | Goal (protection proven)                                                                                     | Risks  | Test types                                      | Status       | Change folder                        |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------- | ------------ | ------------------------------------ |
| 1   | Test runner bootstrap + auth-gating tests | Stand up vitest; lock the default-deny gate against regression (F-01 is the only built slice — testable now) | R3     | unit (allowlist policy), infra (runner)         | complete     | context/changes/testing-auth-gating/ |
| 2   | Data isolation + atomic save              | Cross-user access denied (RLS/ownership); accepted cards persist all-or-nothing                              | R1, R4 | integration                                     | implementing | —                                    |
| 3   | Generation/acceptance rules + privacy     | Draft→human-decision→deck is exact; source text not retained                                                 | R2, R5 | unit (state machine) + integration (generation) | implementing | —                                    |
| 4   | Abuse guard + quality gates in CI         | Generation is bounded (rate/length); lint+typecheck+test gate every PR                                       | R6     | integration + CI wiring                         | implementing | —                                    |

**Prerequisites / order:** Phase 1 is actionable now. Phases 2–3 require the built data + generation slices (F-02 → S-01 → S-02) from the roadmap. Phase 4's CI gate can partially land anytime (lint/typecheck/build already exist in `.github/workflows/ci.yml`); its abuse tests wait for S-01.

### 3.1 Coverage sweep (2026-09-10)

A whole-app sweep took the suite from 62 tests over 9 pure-lib modules to **317 unit/component
tests + 26 logged-out E2E tests**, at 99.2% statements / 98.7% branches / 100% functions.
`src/middleware.ts`, all 11 API endpoints and all 10 React components went from zero coverage
to covered. What this did and did NOT settle, per risk:

| Risk | Now covered                                                                                                                                      | Still open                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| R1   | The **contract**: a statement affecting 0 rows maps to 404, and no write follows a failed load (`flashcards-id`, `submit-rating` endpoint tests) | The **mechanism**: no test runs as two real users against a real database, so the RLS policies themselves are still unexercised |
| R2   | Full triage path — only accepted proposals are sent, edits are preserved, rejected/pending never leave the client (`GenerateForm.test.tsx`)      | —                                                                                                                               |
| R3   | Policy **and** wiring, including the 401-vs-redirect split, at unit and browser level                                                            | —                                                                                                                               |
| R4   | One insert per save (all-or-nothing), owner stamped from the session, 500 on failure with nothing reported as saved                              | A real mid-transaction failure against Postgres                                                                                 |
| R5   | The response never echoes the pasted source text                                                                                                 | That nothing persists or logs it — needs a real DB/log assertion                                                                |
| R6   | An anonymous request never reaches the paid provider                                                                                             | Rate limiting itself: **the feature does not exist yet**, so this is a product gap, not a test gap                              |

**Gate defect found and fixed during the sweep:** the middleware answered protected `/api/*`
routes with a 302 to `/auth/signin`. `fetch()` follows that transparently, so callers received
200 + HTML, `res.ok` was true, and every island treated a rejected write as a success — the
generate screen reported "Saved." for cards that were never stored. Protected API routes now
return `401 {"error":"unauthorized"}`; `isApiRoute()` in `src/lib/route-access.ts` draws the
line, and the behaviour is pinned in `src/middleware.test.ts` and `e2e/auth-gate.spec.ts`.

## 4. Stack

- **Runtime/framework:** Astro 6 SSR + React 19 islands, Cloudflare Workers (`.nvmrc` 22.14.0). Per `tech-stack.md`.
- **Test base:** Vitest (unit + jsdom component) and Playwright (E2E), both wired into `.github/workflows/ci.yml`. Coverage thresholds are enforced in `vitest.config.ts`.
- **Recommended runner (hypothesis for /10x-research to confirm):** Vitest (native to the Vite/Astro toolchain already in the project); Playwright only if a later risk genuinely needs a real browser (none currently do — gating and data rules are cheaper at the integration layer).
- **Stack grounding tools (current session):**
  - Docs: WebSearch/WebFetch ✓ — used to ground the FSRS/ts-fsrs spike; checked 2026-07-08.
  - Search: WebSearch ✓ — used for library comparison; checked 2026-07-08.
  - Runtime/browser: Playwright MCP — not available in current session.
  - Provider/platform: Cloudflare / Supabase MCP — not connected in current session (would help verify RLS + Workers behavior in later phases).

## 5. Test Types → Risk Mapping

- **Integration** (primary layer here): R1 (cross-user access), R3 (route gating), R4 (atomic save), R5 (no retention), R6 (rate/length). Most 10xCards risks live at the request/DB boundary, so integration is the cheapest real signal.
- **Unit**: R2 (draft-state machine transitions — pure logic, high value, cheap).
- **e2e (deferred)**: not justified yet — gating and data rules are catchable at integration for far less cost. Revisit if a multi-step review-session UX regression proves un-catchable lower down.
- **CI gate**: lint + typecheck (`astro check`) + test on every push/PR (extends existing `ci.yml`).

## 6. Cookbook Patterns

Filled in as phases ship (last sub-phase of each rollout phase updates this).

### 6.1 Adding a unit test (pure policy / logic)

- **Runner:** Vitest (`npm test` → `vitest run`). Config: `vitest.config.ts` (plain `defineConfig`, `@/*` alias).
- **Location:** co-located `*.test.ts` next to the module (e.g. `src/lib/route-access.test.ts`).
- **Reference test:** `src/lib/route-access.test.ts` (R3 allowlist guard) — behavioral `it.each` over concrete inputs; oracle from the design contract, not the code.
- **⚠️ Constraint (sharp edge), now solved:** `astro/config`'s `getViteConfig` is INCOMPATIBLE with Vitest here — the Cloudflare adapter's Vite plugin rejects the worker env. Rather than avoiding every `astro:*` importer, `vitest.config.ts` **aliases the two virtual modules the app actually uses** (`astro:env/server`, `astro:middleware`) to stubs in `src/test/stubs/`. That put `src/middleware.ts` and every `src/pages/api` endpoint in reach of plain unit tests. Extracting pure logic is still preferred where it is natural (`route-access.ts`, `due-queue.ts`, `metrics-summary.ts` — the latter two pulled out of `.astro` frontmatter, which remains untestable directly).
- **⚠️ Alias gotcha:** the alias must be `@/` (prefix), not `@`. A bare `@` also rewrites scoped packages such as `@testing-library/react`.
- **Command:** `npm test`. Deliberate-break check: loosen the rule under test, confirm a test goes red, revert.

### 6.2 Adding a unit test (business-rule / state machine)

- **Reference:** `src/lib/save-flashcards.test.ts` (pure handler) and `src/components/generate/GenerateForm.test.tsx` (the triage state machine as the user drives it).
- **Endpoint tests:** live in `src/tests/api/` — deliberately NOT in `src/pages/`, where Astro's file-based routing would publish them as real routes. They import the route module and drive it with `makeApiContext()` from `src/test/factories.ts`.
- **Supabase:** `makeSupabaseStub()` (`src/test/supabase-stub.ts`) is chainable and thenable, so one double covers `.insert()`, `.update().eq().select()` and friends, and records the calls so a test can assert the query it MEANT to send. Use `sequences` when one endpoint issues several statements against the same table.
- **Component tests:** co-located `*.test.tsx` with a `// @vitest-environment jsdom` docblock on line 1 (Vitest 4 dropped `environmentMatchGlobs`). React Testing Library + `user-event`; query by role/label, never by class.

### 6.3 Cross-user isolation test

Partially covered, and the gap is deliberate — see §3.1. The **contract** ("0 affected rows → 404, and never a write") is pinned in `src/tests/api/flashcards-id.test.ts` and `src/tests/api/submit-rating.test.ts`. The **mechanism** (the RLS policies in `supabase/migrations/`) still needs two real accounts against a real database; that is the remaining Phase 2 work and cannot be faked with a stub, since over-mocking the DB is exactly the anti-pattern §2 warns about.

### 6.4 Adding an E2E (browser) test

- **Runner:** Playwright (`npm run test:e2e`). Config: `playwright.config.ts` (`webServer` auto-starts `npm run dev`; `logged-out` project now, authed `storageState` project documented for when login-gated features land). Prereq: `npm i -D @playwright/test && npx playwright install chromium`.
- **Location:** `e2e/*.spec.ts`. Rules + 5 anti-patterns: `e2e/e2e-quality-rules.md`. Reference/seed: `e2e/seed.spec.ts` (auth-gate redirect, R3). Projects are selected by filename: `logged-out` runs `seed|auth-gate|auth-forms`, the authenticated `chromium` project runs `review|deck`.
- **⚠️ Hydration:** a `client:load` island is clickable before it is interactive, and an early click submits the SSR form natively, skipping the React validation under test. Await `waitForIslands(page)` (`e2e/helpers.ts`) after `goto()` on any page with an island.
- **⚠️ CSRF:** Astro rejects a same-site POST with no `Origin` header (403). `request.post()` sends none — pass `headers: { Origin: baseURL }`.
- **Auth:** `e2e/auth.setup.ts` → `storageState` (log in once, reuse); logged-out tests skip it.
- **Scope:** only browser-level risks whose feature is built (crosses auth/routing/API/DB, or exists only in rendered UI). Mock external APIs (LLM) at the network layer; keep internal boundaries real. VERIFY by deliberately breaking the protected behavior → test must go red (revert, never commit).
- **Note:** `e2e/` + `playwright.config.ts` are excluded from `tsconfig`/ESLint until `@playwright/test` is installed.

## 7. Negative Space (explicitly NOT testing)

Decisions recorded so they don't get re-litigated later:

- **Marketing/landing snapshots** — brittle, catch little; landing is the starter `Welcome` page (interview Q5). Owner decision.
- **UI/CSS visual details** — Tailwind styling; low impact, high noise.
- **The FSRS algorithm itself** — `ts-fsrs` is tested upstream; we test _our integration_, not the scheduler's math (per F-03 spike).
- **Admin / metrics surfaces (FR-003, FR-004 review UI)** — nice-to-have, small blast radius, low MVP priority.

## 8. High-impact × Low-likelihood → not tests

- Cloud-provider (Cloudflare/Supabase) global outage: handle via observability/alerting, not a test scenario.
