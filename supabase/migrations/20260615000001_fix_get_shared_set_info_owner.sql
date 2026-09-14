-- Add owner_id to get_shared_set_info so callers can detect self-links server-side.
-- Also add missing index on session_log(set_id) for get_donated_sets_for_teacher JOIN.
create index if not exists session_log_set_id_idx on public.session_log(set_id);

-- DROP required because CREATE OR REPLACE cannot change return type columns.
drop function if exists public.get_shared_set_info(uuid);

create function public.get_shared_set_info(p_token uuid)
returns table(set_id uuid, owner_id uuid, set_name text, flashcard_count bigint)
language sql
security definer
stable
set search_path = ''
as $$
  select
    s.id               as set_id,
    s.user_id          as owner_id,
    s.name             as set_name,
    count(f.id)        as flashcard_count
  from public.sets s
  left join public.flashcards f on f.set_id = s.id
  where s.share_token = p_token
  group by s.id, s.user_id, s.name;
$$;

grant execute on function public.get_shared_set_info(uuid) to authenticated, anon;
