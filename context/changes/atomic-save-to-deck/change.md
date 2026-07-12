---
change_id: atomic-save-to-deck
title: Atomic save of accepted proposals to the deck + basic deck view
status: implemented
created: 2026-07-10
updated: 2026-07-10
archived_at: null
---

## Notes

Roadmap slice S-02 (north star — closes the gated loop). Outcome: accepted proposals from S-01 are saved atomically to the user's deck (`flashcards`), and the user sees the saved list. PRD refs: US-01, FR-007, FR-009. Depends on F-02 (flashcards table + RLS, applied) and S-01 (accepted proposals). Atomicity (R4): a single Supabase `.insert([rows])` is one statement → all-or-nothing. Only accepted proposals persist (R2). Persistence is owner-scoped by RLS (R1).
