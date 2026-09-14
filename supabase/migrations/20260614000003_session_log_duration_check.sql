-- Enforce that ended_at is strictly after started_at at the DB level.
-- The API already validates this (400 response), but this constraint prevents
-- invalid rows from direct DB writes or future services bypassing the API.
alter table public.session_log
  add constraint session_log_valid_duration check (ended_at > started_at);
