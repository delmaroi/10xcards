---
change_id: google-sso
title: Google OAuth sign-in (federated SSO)
status: implementing
created: 2026-07-12
updated: 2026-07-12
archived_at: null
---

## Notes

Resolves the FR-001 gap surfaced by the full-project audit: the PRD asks for **federated SSO** ("produkt nie przechowuje haseł"), but the app shipped email+password only (roadmap Open Q1/Q5). Adds Google OAuth via Supabase alongside the existing email/password (kept — students without Google still sign in). Provider choice = Google (roadmap Open Q5 preference).

Code scope (this change): OAuth init endpoint + PKCE callback + "Continue with Google" buttons on signin/signup.

Hard prerequisites — **[Human] config, code won't function until done**:
- Google Cloud Console: create an OAuth 2.0 client; authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
- Supabase dashboard → Authentication → Providers → Google: enable, paste Client ID + Secret.
- Supabase → URL Configuration: add `http://localhost:4321` and the prod Worker URL to redirect allowlist.
