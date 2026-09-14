-- Add per-account text-to-speech voice preferences to user_preferences.
-- One voice for the Front side, one for the Back side of a flashcard.
-- Additive nullable columns only: the app coalesces null to DEFAULT_VOICE.
-- No new GRANT or RLS policy needed — the existing table-level grant and
-- own-row policies (20260617000001_user_preferences.sql) cover new columns.

alter table public.user_preferences
  add column tts_voice_front text,
  add column tts_voice_back text;
