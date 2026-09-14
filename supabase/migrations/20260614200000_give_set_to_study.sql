-- give-set-to-study: drop insecure anon policies, create set_shares, install SECURITY DEFINER RPCs.

-- ============================================================
-- 1. Drop insecure anon RLS policies (lessons.md: anon policies
--    must not expose capability tokens via broad SELECT).
-- ============================================================
drop policy if exists sets_select_shared_anon on public.sets;
drop policy if exists flashcards_select_shared_anon on public.flashcards;

-- ============================================================
-- 2. set_shares tracking table
-- ============================================================
create table public.set_shares (
  id                uuid primary key default gen_random_uuid(),
  original_set_id   uuid not null references public.sets(id) on delete cascade,
  cloned_set_id     uuid not null references public.sets(id) on delete cascade,
  sharer_user_id    uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email   text not null,
  claimed_at        timestamptz not null default now(),
  constraint set_shares_unique_claim unique (original_set_id, recipient_user_id)
);

create index set_shares_sharer_idx on public.set_shares(sharer_user_id);
create index set_shares_original_set_idx on public.set_shares(original_set_id);

alter table public.set_shares enable row level security;

-- Sharer can see their own shares.
create policy set_shares_select_sharer
on public.set_shares
for select
to authenticated
using ((select auth.uid()) = sharer_user_id);

-- Recipient can see shares directed at them.
create policy set_shares_select_recipient
on public.set_shares
for select
to authenticated
using ((select auth.uid()) = recipient_user_id);

-- No client-side INSERT: inserts go through SECURITY DEFINER RPC only.
grant select on public.set_shares to authenticated;

-- ============================================================
-- 3. get_shared_set_info(p_token uuid)
--    Returns set metadata for a share link (0 rows if not found).
--    Granted to anon so server-rendered page works for visitors.
-- ============================================================
create or replace function public.get_shared_set_info(p_token uuid)
returns table(set_id uuid, set_name text, flashcard_count bigint)
language sql
security definer
stable
set search_path = ''
as $$
  select
    s.id               as set_id,
    s.name             as set_name,
    count(f.id)        as flashcard_count
  from public.sets s
  left join public.flashcards f on f.set_id = s.id
  where s.share_token = p_token
  group by s.id, s.name;
$$;

grant execute on function public.get_shared_set_info(uuid) to authenticated, anon;

-- ============================================================
-- 4. claim_shared_set(p_token uuid)
--    Clones the set (name + flashcards, FSRS defaults) for the
--    authenticated caller and records the share in set_shares.
--    Returns (cloned_set_id, already_claimed).
-- ============================================================
create or replace function public.claim_shared_set(p_token uuid)
returns table(cloned_set_id uuid, already_claimed boolean)
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_caller_id      uuid;
  v_caller_email   text;
  v_original_set   record;
  v_new_set_id     uuid;
  v_share_row      record;
begin
  -- Guard: caller must be authenticated.
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve the share token to the original set.
  select id, user_id, name
  into v_original_set
  from public.sets
  where share_token = p_token;

  if not found then
    raise exception 'Share token not found';
  end if;

  -- Guard: owner cannot claim their own set.
  if v_original_set.user_id = v_caller_id then
    raise exception 'Cannot claim your own set';
  end if;

  -- Idempotency: return existing clone if already claimed.
  select ss.cloned_set_id
  into v_share_row
  from public.set_shares ss
  where ss.original_set_id = v_original_set.id
    and ss.recipient_user_id = v_caller_id;

  if found then
    return query select v_share_row.cloned_set_id, true;
    return;
  end if;

  -- Resolve caller email from auth.users.
  select email
  into v_caller_email
  from auth.users
  where id = v_caller_id;

  -- Insert the cloned set owned by the caller.
  insert into public.sets (user_id, name)
  values (v_caller_id, v_original_set.name)
  returning id into v_new_set_id;

  -- Copy flashcards (front + back only; FSRS fields keep their defaults).
  insert into public.flashcards (set_id, front, back)
  select v_new_set_id, f.front, f.back
  from public.flashcards f
  where f.set_id = v_original_set.id;

  -- Record the share.
  insert into public.set_shares
    (original_set_id, cloned_set_id, sharer_user_id, recipient_user_id, recipient_email)
  values
    (v_original_set.id, v_new_set_id, v_original_set.user_id, v_caller_id, v_caller_email);

  return query select v_new_set_id, false;
end;
$$;

grant execute on function public.claim_shared_set(uuid) to authenticated;

-- ============================================================
-- 5. get_donated_sets_for_teacher()
--    Returns one row per set_shares row where the caller is the
--    sharer, with cross-ownership stats on the cloned set.
-- ============================================================
create or replace function public.get_donated_sets_for_teacher()
returns table(
  share_id          uuid,
  cloned_set_id     uuid,
  original_set_name text,
  cloned_set_name   text,
  recipient_email   text,
  claimed_at        timestamptz,
  total_flashcards  bigint,
  learned_count     bigint,
  last_activity     timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    ss.id                                    as share_id,
    ss.cloned_set_id,
    orig.name                                as original_set_name,
    clone.name                               as cloned_set_name,
    ss.recipient_email,
    ss.claimed_at,
    count(f.id)                              as total_flashcards,
    count(f.id) filter (where f.state = 2)  as learned_count,
    max(sl.ended_at)                         as last_activity
  from public.set_shares ss
  join public.sets orig  on orig.id  = ss.original_set_id
  join public.sets clone on clone.id = ss.cloned_set_id
  left join public.flashcards f on f.set_id = ss.cloned_set_id
  left join public.session_log sl on sl.set_id = ss.cloned_set_id
  where ss.sharer_user_id = auth.uid()
  group by ss.id, orig.name, clone.name, ss.recipient_email, ss.claimed_at;
$$;

grant execute on function public.get_donated_sets_for_teacher() to authenticated;
