---
change_id: first-gated-generation
title: First gated AI generation loop — paste text, triage card proposals
status: implemented
created: 2026-07-10
updated: 2026-07-10
archived_at: null
---

## Notes

Roadmap slice S-01 (north-star half). Outcome: a logged-in user pastes source text, the app generates flashcard proposals via an LLM, and the user accepts / edits / rejects each. PRD refs: US-01, FR-005, FR-006. Depends on F-02 (flashcards table) for the eventual save (S-02). Drafts are ephemeral (held client-side during triage); only accepted cards persist, and persistence is S-02's job. Hard dependencies for implementation: F-02 migration applied + an OpenRouter API key. Privacy guardrail (R5): pasted text must not be retained after the request. Abuse guardrail (R6): input length limit + basic rate limiting.
