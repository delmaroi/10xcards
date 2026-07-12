---
change_id: minimal-flashcard-persistence
title: Minimal per-user flashcard persistence with RLS isolation
status: implemented
created: 2026-07-10
updated: 2026-07-10
archived_at: null
---

## Notes

Roadmap foundation F-02 from `context/foundation/roadmap.md`. Outcome: a minimal per-user flashcard/deck data model exists with row-level isolation, so a card can be stored and read back only by its owner. Unlocks S-01, S-02, S-03, S-04, S-05. PRD refs: FR-007, Success Criteria guardrail ("pełna izolacja danych między kontami"), Access Control. Kept minimal (flashcards owned by a user + RLS), NOT a full domain schema — it must be exercised immediately by S-01/S-02. The SRS spike (`context/changes/srs-library-spike/research.md`) fixed that review state will ride on the flashcard row as a JSON column later (S-04). Dependency: applying/verifying the migration needs a running Supabase (local Docker or cloud).
