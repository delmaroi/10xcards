---
project: "10xCards"
version: 1
status: draft
created: 2026-07-08
updated: 2026-07-12
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: 10xCards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Student przed egzaminem ma dużo materiału i mało czasu; ręczne tworzenie fiszek jest zbyt mozolne, by w ogóle zacząć spaced repetition. 10xCards obniża próg wejścia, generując fiszki z wklejonego tekstu przez AI, z ludzką akceptacją każdej karty. Produktowy wedge — jedyna cecha, której usunięcie sprawia, że produkt staje się generyczny — to fiszki jednocześnie **generowane AI z własnego materiału użytkownika** i **zatwierdzane przez człowieka**, zanim trafią do talii.

## North star

**S-02: Zaakceptowane fiszki trafiają atomowo do talii** — north star (najmniejszy przepływ end-to-end, którego udane dowiezienie dowodzi głównej hipotezy produktu; umieszczony tak wcześnie, jak pozwalają zależności). To domknięcie bramkowanej pętli: dopiero gdy zatwierdzone karty realnie lądują w talii, mierzalna jest główna metryka (≥75% akceptacji), a wedge jest udowodniony. Wymaga najpierw S-01 (generacja + triage).

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                  | Prerequisites | PRD refs               | Status   |
| ---- | ----------------------------- | ----------------------------------------------------- | ------------- | ---------------------- | -------- |
| F-01 | gate-product-routes           | (foundation) product routes behind login + landing    | —             | FR-001, FR-002         | implemented  |
| F-02 | minimal-flashcard-persistence | (foundation) per-user flashcard store with isolation  | —             | FR-007                 | implemented  |
| F-03 | srs-library-spike             | (foundation) chosen SRS library contract verified     | —             | FR-012                 | implemented  |
| S-01 | first-gated-generation        | paste text and triage AI card proposals               | F-01, F-02    | US-01, FR-005, FR-006  | implemented  |
| S-02 | atomic-save-to-deck           | finalize accepted cards into the deck                 | S-01          | US-01, FR-007, FR-009  | implemented  |
| S-03 | deck-edit-delete              | browse, edit and delete saved cards                   | S-02          | FR-009, FR-010, FR-011 | implemented  |
| S-04 | success-metrics-collection    | admin can see AI acceptance-rate and AI-share metrics | S-02          | FR-004                 | proposed     |
| S-05 | srs-review-session            | run a review session and record a card rating         | S-02, F-03    | US-01, FR-012          | implementing |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme           | Chain                                      | Note                                                          |
| ------ | --------------- | ------------------------------------------ | ------------------------------------------------------------- |
| A      | Wedge & deck    | `F-01` / `F-02` → `S-01` → `S-02` → `S-03` | The must-have path; north star `S-02` closes the gated loop.  |
| B      | Success metrics | `S-04`                                     | Joins Stream A at `S-02` (needs accept/save events).          |
| C      | Review loop     | `F-03` → `S-05`                            | Joins Stream A at `S-02`; F-03 resolved the SRS choice (FSRS via ts-fsrs). |

## Baseline

What's already in place in the codebase as of `2026-07-08` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands, Tailwind 4 (`src/components/`, `src/pages/`, `astro.config.mjs`).
- **Backend / API:** present — Astro API routes for auth (`src/pages/api/auth/{signin,signup,signout}.ts`).
- **Data:** absent — no migrations, no `supabase/migrations/`, no domain tables. Supabase is used for `auth.users` only. This is the primary Foundations gap.
- **Auth:** present — Supabase SSR client (`src/lib/supabase.ts`), session middleware with `PROTECTED_ROUTES` (`src/middleware.ts`), auth pages + endpoints. Note: current provider is email/password, not federated SSO (see Open Roadmap Questions).
- **Deploy / infra:** present — Cloudflare Workers, deployed live (`10x-cards.mariusz-jarzabek.workers.dev`); secrets via `wrangler secret`. No separate deploy foundation needed. See `context/deployment/deploy-plan.md`.
- **Observability:** partial — `wrangler.jsonc` `observability.enabled: true` (platform logs via `wrangler tail`); no app-level error tracking or structured logging library.

## Foundations

### F-01: Gate product routes

- **Outcome:** (foundation) product routes require login and unauthenticated visitors land on a public page — no product surface is reachable without a session.
- **Change ID:** gate-product-routes
- **PRD refs:** FR-001, FR-002, Access Control
- **Unlocks:** S-01 (the generation loop must be scoped to "my" session before it can save "my" cards).
- **Prerequisites:** —
- **Parallel with:** F-02, F-03
- **Blockers:** —
- **Unknowns:**
  - Federated SSO vs. keeping the baseline email/password auth for MVP? — Owner: user. Block: no. (Email/password auth is already wired; swapping to SSO is a decision, not a hard blocker on this foundation.)
- **Risk:** Small extension of an existing middleware. Sequenced first because every slice below is per-user; without route gating, data isolation guardrails cannot hold.
- **Status:** implemented

### F-02: Minimal flashcard persistence

- **Outcome:** (foundation) a minimal per-user flashcard/deck data model exists with row-level isolation, so a card can be stored and read back only by its owner.
- **Change ID:** minimal-flashcard-persistence
- **PRD refs:** FR-007, Success Criteria guardrail (per-account data isolation), Access Control
- **Unlocks:** S-01, S-02, S-03, S-04, S-05 (nothing can persist a card without a table).
- **Prerequisites:** —
- **Parallel with:** F-01, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kept intentionally minimal (flashcards owned by a user + RLS), NOT a full domain schema. It is exercised immediately by S-01/S-02, so it stays a vertical enabler rather than a horizontal data-layer project.
- **Status:** implemented

### F-03: SRS library spike

- **Outcome:** (foundation) the chosen ready-made spaced-repetition library's contract is verified — data model (ReviewState), rating scale, and the "what happens after a card is edited" policy are known.
- **Change ID:** srs-library-spike
- **PRD refs:** FR-012, Open Question 4
- **Unlocks:** S-05 (review session cannot be planned until the library's ReviewState/rating shape is fixed).
- **Prerequisites:** —
- **Parallel with:** F-01, F-02
- **Blockers:** —
- **Unknowns:**
  - Which library, and does its data model fit our storage? — Owner: user + downstream. Block: no (this spike exists precisely to resolve it).
- **Risk:** PRD flags the ready-made-algorithm integration as a potential hidden cost. A short spike de-risks S-05 before any review UI is planned.
- **Status:** implemented

## Slices

### S-01: First gated generation

- **Outcome:** User can paste source text, request AI-generated card proposals, and accept / edit / reject each proposal.
- **Change ID:** first-gated-generation
- **PRD refs:** US-01, FR-005, FR-006
- **Prerequisites:** F-01, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - LLM provider + privacy mode meeting the "pasted text stays private, not retained after the request" guardrail? — Owner: user. Block: no (pick a provider with a privacy mode; verify on a deployed request).
  - Upper length limit for pasted text (Open Question 2)? — Owner: user + downstream. Block: no (a sensible default unblocks the slice; tune later).
- **Risk:** This is the product wedge and the first real LLM integration. Sequenced first among slices because everything downstream reads/edits the cards this loop produces.
- **Status:** implemented

### S-02: Atomic save to deck

- **Outcome:** User can finalize accepted proposals so that all accepted cards land in the deck atomically (all-or-nothing), then see the saved list.
- **Change ID:** atomic-save-to-deck
- **PRD refs:** US-01, FR-007, FR-009
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** North star. Here the FlashcardDraft business rule closes — a card is an AI proposal until a human decision commits it — and the ≥75% acceptance metric first becomes real. Atomicity protects the "no data loss" guardrail.
- **Status:** implemented

### S-03: Deck edit & delete

- **Outcome:** User can browse the full deck, edit a saved card, and delete a card.
- **Change ID:** deck-edit-delete
- **PRD refs:** FR-009, FR-010, FR-011
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Deck hygiene. Independent of metrics (S-04), so the two can run in parallel agent runs once S-02 lands.
- **Status:** implemented

### S-04: Success-metrics collection

- **Outcome:** Admin can see the two success metrics — AI-card acceptance rate and the AI-vs-manual share of created cards.
- **Change ID:** success-metrics-collection
- **PRD refs:** FR-004
- **Prerequisites:** S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - Minimum viable surface for the admin view (must-have is collection; the rich admin UI is nice-to-have) — Owner: user. Block: no.
- **Risk:** FR-004 is must-have because the PRD's primary success criteria are numeric (75% thresholds) and cannot be judged without instrumentation. Sequenced right after S-02 because the accept/reject/save events it measures only exist once the gated loop works.
- **Status:** proposed

### S-05: SRS review session

- **Outcome:** User can run a spaced-repetition review session over saved cards and have a card rating recorded.
- **Change ID:** srs-review-session
- **PRD refs:** US-01, FR-012
- **Prerequisites:** S-02, F-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - The SRS library's ReviewState shape, rating scale, and post-edit policy (Open Question 4) — Owner: user + downstream. Block: yes.
- **Risk:** Completes the full learning thesis, but the ready-made-algorithm contract dictates the ReviewState model and rating flow. Was blocked on F-03; now resolved (FSRS via ts-fsrs) — exactly the kind of unknown that should surface on the roadmap, not mid-implementation.
- **Status:** implementing (/review built; manual 3.4–3.6 pending)

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                              | Ready for `/10x-plan` | Notes                                         |
| ---------- | ----------------------------- | -------------------------------------------------- | --------------------- | --------------------------------------------- |
| F-01       | gate-product-routes           | Gate product routes behind login + landing page    | done                  | ✓ implemented                                 |
| F-02       | minimal-flashcard-persistence | Minimal per-user flashcard persistence + RLS       | done                  | ✓ implemented                                 |
| F-03       | srs-library-spike             | Spike: verify SRS library contract                 | done                  | ✓ implemented (FSRS via ts-fsrs)              |
| S-01       | first-gated-generation        | First gated AI generation loop (paste → triage)    | done                  | ✓ implemented                                 |
| S-02       | atomic-save-to-deck           | Atomic save of accepted cards to deck (north star) | done                  | ✓ implemented                                 |
| S-03       | deck-edit-delete              | Browse, edit and delete saved cards                | done                  | ✓ implemented                                 |
| S-04       | success-metrics-collection    | Collect AI acceptance-rate & AI-share metrics      | yes                   | Unblocked (S-02 shipped); FR-004 still unbuilt — **only remaining must-have** |
| S-05       | srs-review-session            | Spaced-repetition review session                   | in progress           | /review built; manual 3.4–3.6 pending e2e run |

## Open Roadmap Questions

1. **Federated SSO vs. email/password** — add classic email/password alongside (or instead of) SSO so students without an SSO account aren't excluded? Baseline currently ships email/password. Owner: user. Block: F-01 (no — decision, not a hard blocker).
2. **Pasted-text length limit + generation quality threshold** — concrete upper bound and quality bar (PRD Open Question 2). Owner: user + downstream. Block: S-01 (no — default unblocks).
3. **Bulk "accept all" action** — needed in MVP when many cards are generated at once (PRD Open Question 3)? Owner: user. Block: none (nice-to-have candidate).
4. **SRS library / review data model choice** — which ready-made library, what ReviewState + schedule (PRD Open Question 4)? Owner: user + downstream. Block: S-05 (yes) — drives F-03.
5. **Federated SSO provider** (preference: Google) — concrete provider pick (PRD Open Question 5). Owner: tech-stack step. Block: F-01 (no).
6. **LLM provider + privacy posture** — which provider and privacy mode satisfy the "pasted text stays private / not retained after the request" guardrail? Owner: user. Block: S-01 (no — verify on a deployed request).

## Parked

- **Own advanced SRS algorithm (SuperMemo/Anki-style)** — Why parked: PRD Non-Goals; we use a ready-made algorithm.
- **Multi-format import (PDF, DOCX, …)** — Why parked: PRD Non-Goals; paste-only in MVP.
- **Sharing flashcard sets between users** — Why parked: PRD Non-Goals; data is private/single-user (and this removes cross-user moderation too).
- **Integrations with other learning platforms** — Why parked: PRD Non-Goals.
- **Native mobile apps** — Why parked: PRD Non-Goals; web-only MVP.
- **Admin user management (list / block / delete users)** — Why parked: FR-003 is nice-to-have; not on the MVP learning path (main_goal = speed).
- **Manual card creation** — Why parked: FR-008 is nice-to-have; AI generation is the wedge. Revisit after the loop works.
- **Rich admin metrics dashboard** — Why parked: FR-004 collection is must-have (S-04), but the polished admin review UI is nice-to-have.
- **Content moderation** — Why parked: removed during shaping; no cross-user sharing means no inter-user moderation need.

## Done

(Empty on first generation. `/10x-archive` appends entries here when a matching change is archived.)
