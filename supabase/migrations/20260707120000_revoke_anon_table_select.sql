-- Revoke the dormant anon SELECT grant on sets/flashcards.
--
-- Lesson "RLS anon policies must not expose capability tokens": reads gated by a
-- capability token must go exclusively through the SECURITY DEFINER RPC
-- get_shared_set_info (which never returns share_token), never through a broad
-- anon table grant. The broad anon SELECT *policy* was already dropped
-- (20260614200000_give_set_to_study.sql), but the table-level GRANT from
-- 20260613105815_grant_table_permissions.sql was left behind — a latent footgun
-- that would re-open token enumeration the moment a broad anon policy returned.
-- Remove it so the anon path is strictly the token-scoped RPC. The execute grant
-- on get_shared_set_info(uuid) to anon is retained (it is a function grant, not a
-- table grant, so it is untouched here).

revoke select on public.sets from anon;
revoke select on public.flashcards from anon;
