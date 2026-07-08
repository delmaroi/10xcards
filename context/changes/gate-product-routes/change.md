---
change_id: gate-product-routes
title: Gate product routes behind login and add a public landing page
status: implementing
created: 2026-07-08
updated: 2026-07-08
archived_at: null
---

## Notes

Roadmap item F-01 (foundation) from `context/foundation/roadmap.md`. Outcome: product routes require login and unauthenticated visitors land on a public page — no product surface is reachable without a session. Unlocks S-01. PRD refs: FR-001, FR-002, Access Control. Baseline auth (email/password via Supabase SSR + `src/middleware.ts` `PROTECTED_ROUTES`) is already present; this change extends route protection to product paths. Open question (non-blocking): federated SSO vs. keeping email/password for MVP.
