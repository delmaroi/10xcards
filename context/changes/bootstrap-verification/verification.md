---
bootstrapped_at: 2026-06-17T09:37:09Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: 10x-cards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim from `context/foundation/tech-stack.md`:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack:** Solo student building 10xCards — a flashcard MVP in roughly three weeks of after-hours work, with federated login and an LLM generation step. That profile needs a battle-tested, agent-friendly starter that ships auth, a database, and edge deploy out of the box rather than one assembled by hand. The 10x Astro Starter (Astro + React + TypeScript + Tailwind + Supabase + Cloudflare) is the recommended default for (web, js) and clears all four agent-friendly gates. Supabase covers auth and persistence; the AI flag is set because flashcard generation needs an LLM integration the starter does not include. Payments, realtime, and background jobs are out of scope per the PRD non-goals. Deployment targets Cloudflare Pages; CI on GitHub Actions with auto-deploy on merge.

## Pre-scaffold verification

| Signal       | Value                                          | Severity | Notes                                              |
| ------------ | ---------------------------------------------- | -------- | -------------------------------------------------- |
| npm package  | not run                                        | n/a      | cmd_template starts with `git clone` — npm step skipped per spec |
| GitHub repo  | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from card.docs_url; `gh` unavailable, fetched read-only via api.github.com |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19 top-level entries (.env.example, .github, .gitignore, .husky, .nvmrc, .prettierrc.json, .vscode, CLAUDE.md, README.md, astro.config.mjs, components.json, eslint.config.js, node_modules, package-lock.json, public, src, supabase, tsconfig.json, wrangler.jsonc)
**Conflicts (.scaffold siblings)**: package.json → package.json.scaffold (cwd had a pre-existing empty package.json; existing-wins policy applied)
**.gitignore handling**: moved silently (cwd had none)
**context/ handling**: scaffold carried no context/; cwd context/ preserved verbatim
**.bootstrap-scaffold cleanup**: deleted (incl. cloned .git/ removed before move-up)

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 8 HIGH, 9 MODERATE, 1 LOW (18 total)
**Direct vs transitive**: 5 direct vulnerable top-level packages of 18 advisories (npm audit reports advisories per-package; severity-by-direct not fully separable from this output)

#### CRITICAL findings
None.

#### HIGH findings
8 high-severity advisories. Direct vulnerable packages among the dependency tree: `@astrojs/check`, `@astrojs/cloudflare`, `astro`, `supabase`, `wrangler`. Run `npm audit` (without `--json`) for the per-advisory detail and `npm audit fix` for non-breaking remediations.

#### MODERATE findings
9 moderate-severity advisories across the dependency tree.

#### LOW / INFO findings
1 low-severity advisory.

> Note: these counts come from the starter's pinned dependencies as cloned; remediation is left to the user (`npm audit fix` for non-breaking, `npm audit fix --force` for breaking). Bootstrapper informs, does not auto-fix.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- **Replace the empty `package.json`**: the cwd had a 0-byte `package.json` that won the conflict; the starter's real manifest is at `package.json.scaffold`. Run `mv package.json.scaffold package.json` (overwriting the empty one) or the project will not build. The starter also shipped `CLAUDE.md` — review it.
- `git init` (if you have not already) to start your own repo history (the cloned upstream history was removed).
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log (`npm audit`, `npm audit fix`).
- Configure Supabase (auth + DB) and add your LLM generation + spaced-repetition pieces — these are the build-it-yourself parts flagged in the PRD open questions.
