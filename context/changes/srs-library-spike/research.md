---
topic: SRS algorithm + TypeScript library choice for review sessions (F-03 spike)
researcher: external research (WebSearch + WebFetch grounding)
date: 2026-07-08
change_id: srs-library-spike
unblocks: srs-review-session (S-04), Open Roadmap Question 4
---

# SRS Library Spike — External Research

## Question

Which spaced-repetition **algorithm** and **TypeScript library** should 10xCards use for review sessions (S-04), and what is its current API contract? This is a contract decision — the choice fixes the `ReviewState` shape, the rating scale, and the edit-vs-reset policy that propagate through S-04.

> Grounding note: Exa.ai and Context7 MCP (the lesson's tools) require per-account credentials, so this spike used the built-in **WebSearch/WebFetch** for the same effect — decisions are grounded in current sources, not model training memory. Facts below carry source links.

## Recommendation

**Use FSRS via the `ts-fsrs` library (open-spaced-repetition).**

One sentence: _we choose `ts-fsrs` because it is the maintained, first-party TypeScript implementation of FSRS — the algorithm Anki adopted as its default in v23.10 (Nov 2023) — which needs ~20–30% fewer reviews than the classic SM-2 for the same retention, ships ESM/CJS/UMD types, and requires Node ≥20 (we run 22)._

## Candidates considered

| Option                 | What it is                                                                             | Verdict                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **FSRS via `ts-fsrs`** | Modern trained scheduler (Difficulty/Stability/Retrievability); first-party TS package | **Chosen** — maintained, typed, Anki's default, best accuracy                                                             |
| **SM-2 (hand-rolled)** | 1987 heuristic (easeFactor / interval / repetitions), 6-grade scale                    | Rejected — simpler to reason about but ~16% scheduling error vs FSRS's ~5%; no upside for us                              |
| **Custom scheduler**   | Roll our own                                                                           | Rejected — "a few lines with setTimeout" is a trap; a correct SRS is real domain work (PRD Non-Goal: no custom algorithm) |

## Why FSRS over SM-2 (grounded)

- FSRS is a trained model (defaults from millions of reviews, fine-tunable per user); SM-2 is a fixed 1980s heuristic. ([antiagent.io](https://www.antiagent.io/blog/fsrs-vs-sm-2), [diane.app](https://www.diane.app/en/guides/fsrs-vs-sm2))
- On 500M+ Anki reviews, FSRS needs **20–30% fewer reviews** for the same retention; to hold 90% retention FSRS deviates ±5.3% vs SM-2 ±16.2%. ([flica.app](https://flica.app/article/fsrs-vs-sm2), [expertium benchmark](https://expertium.github.io/Benchmark.html))
- Anki made FSRS the **default in v23.10 (Nov 2023)**. ([RemNote help](https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm))
- Aligns with PRD FR-012 "gotowy algorytm" and the Non-Goal against building our own scheduler.

## API contract (current — from ts-fsrs README)

Latest line is **5.x** (unpkg showed `ts-fsrs@5.4.1`); **Node ≥20**; TypeScript, ESM/CJS/UMD. ([npm](https://www.npmjs.com/package/ts-fsrs), [GitHub](https://github.com/open-spaced-repetition/ts-fsrs))

Canonical minimal usage (verbatim from the README):

```typescript
import { createEmptyCard, fsrs, Rating } from "ts-fsrs";

const scheduler = fsrs();
const card = createEmptyCard();

const preview = scheduler.repeat(card, new Date()); // all four ratings' outcomes
const result = scheduler.next(card, new Date(), Rating.Good); // apply one rating

console.log(preview[Rating.Good].card);
console.log(result.card); // updated Card
console.log(result.log); // ReviewLog
```

- **`Rating`** enum: `Again | Hard | Good | Easy` (4-grade scale → 4 UI buttons). ([npm](https://www.npmjs.com/package/ts-fsrs))
- **`State`** enum: `New | Learning | Review | Relearning`.
- **`Card`** fields: `due`, `stability`, `difficulty`, `state`, `reps`, `lapses` (plus `elapsed_days`, `scheduled_days`, `last_review` in the full type). ([npm](https://www.npmjs.com/package/ts-fsrs))
- Key exports: `createEmptyCard`, `fsrs`, `generatorParameters`, `Rating`, `State`, `Card`, `RecordLog`/`ReviewLog`.

## Fit with 10xCards (contract decisions this fixes for S-04)

- **ReviewState shape** → store the whole `Card` object (from `createEmptyCard`, updated via `scheduler.next(...).card`) as JSON on the flashcard row (e.g. a `review_state` column). Depends on **F-02** (flashcard persistence) existing first.
- **Rating scale** → 4 buttons: `Again / Hard / Good / Easy`.
- **Due selection** → "cards due today" = rows whose `review_state.due <= now`.
- **Compatibility** → Node ≥20 satisfied (we run 22.14.0); TS/ESM matches the Astro stack.

## Open Questions (leave explicit — do NOT let the plan guess)

1. **Edit-vs-reset policy** — when a user edits a saved card's front/back, does its `Card` review state reset or persist? FSRS state is tied to the item; a content change may warrant a reset. Owner: user. Decide in S-04 plan.
2. **Where model parameters live** — default `fsrs()` params vs per-user optimized params (needs `@open-spaced-repetition/binding` optimizer + review history). MVP: default params. Owner: user.
3. **Timezone / "today" boundary** for due-date comparison. Owner: downstream plan.

## Sources

- [FSRS vs SM-2 — antiagent.io](https://www.antiagent.io/blog/fsrs-vs-sm-2)
- [FSRS vs SM-2 — diane.app](https://www.diane.app/en/guides/fsrs-vs-sm2)
- [FSRS vs SM-2 (2026) — flica.app](https://flica.app/article/fsrs-vs-sm2)
- [Open Spaced Repetition benchmark — expertium](https://expertium.github.io/Benchmark.html)
- [FSRS in Anki — RemNote help](https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm)
- [ts-fsrs — npm](https://www.npmjs.com/package/ts-fsrs)
- [ts-fsrs — GitHub](https://github.com/open-spaced-repetition/ts-fsrs)
