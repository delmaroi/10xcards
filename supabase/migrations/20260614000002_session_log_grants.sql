-- Idempotent hotfix: 20260614000001 already contains this GRANT, but `supabase migration up --include-all`
-- skipped it on first local apply (Supabase default-grant init had not yet run for the new table).
-- Safe to re-run; has no effect if the grant already exists.
grant select, insert on public.session_log to authenticated;
