---
change_id: deck-edit-delete
title: Browse, edit and delete saved cards
status: implemented
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Roadmap slice S-03. Outcome: user can browse (FR-009), edit (FR-010) and delete (FR-011) saved flashcards. Depends on S-02 (deck + `/deck` view exist). Edit/delete are owner-scoped by RLS (a non-owner's update/delete matches 0 rows). Turns the static `/deck` list into an interactive island.
