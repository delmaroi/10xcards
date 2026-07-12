---
change_id: success-metrics-collection
title: Collect AI acceptance-rate and AI-share success metrics
status: implementing
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Roadmap slice S-04 from `context/foundation/roadmap.md`. Outcome: the app **collects** the data needed to measure the PRD's two success criteria — (1) ≥75% of AI-generated cards accepted (acceptance rate), and (2) ≥75% of all cards created via AI (AI-share). PRD refs: FR-004 (must-have), Success Criteria (prd.md:47-48). Per PRD (prd.md:89) the **collection is must-have; the admin review UI is nice-to-have** — so this slice's core is capture, with only a minimal metrics surface.

Scoping decisions (MVP):
- **Capture point:** record a `generation_stats` row at save time with `{generated, accepted, edited}` counts (the client holds these after triage). Known limitation: a batch where the user accepts nothing (never saves) is not recorded — acceptable MVP approximation, documented.
- **AI-share** needs no new capture — computed from `flashcards.source` (the `'ai'|'manual'` column F-02 added for exactly this).
- **Admin identity:** env allowlist `ADMIN_EMAILS` (no role system; FR-003 full admin is Parked).
- Org-wide aggregation across all users needs a service-role read (RLS is owner-scoped); deferred as nice-to-have. The must-have deliverable is that the data is captured.
