-- Session log table for tracking review session duration (S-06)

create table public.session_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null references public.sets(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null
);

create index session_log_user_started_idx on public.session_log(user_id, started_at desc);

alter table public.session_log enable row level security;

create policy session_log_insert_own
on public.session_log
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy session_log_select_own
on public.session_log
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert on public.session_log to authenticated;
