---
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

Solo student building 10xCards — a flashcard MVP in roughly three weeks of after-hours work, with federated login and an LLM generation step. That profile needs a battle-tested, agent-friendly starter that ships auth, a database, and edge deploy out of the box rather than one assembled by hand. The 10x Astro Starter (Astro + React + TypeScript + Tailwind + Supabase + Cloudflare) is the recommended default for (web, js) and clears all four agent-friendly gates: typed, convention-based, popular in training data, well-documented. Supabase covers the auth and persistence the PRD's FRs require; the AI feature flag is set because flashcard generation needs an LLM integration the starter does not include — that, plus the spaced-repetition library, are the known build-it-yourself pieces flagged in the PRD's open questions. Payments, realtime, and background jobs are out of scope per the PRD non-goals. Deployment targets Cloudflare Pages (the starter default); CI runs on GitHub Actions with auto-deploy on merge — the standard solo shape. Bootstrapper confidence is first-class, so scaffolding should be smooth with occasional manual touch-ups.
