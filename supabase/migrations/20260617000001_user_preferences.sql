create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en',
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy user_preferences_select_own
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_preferences_insert_own
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_preferences_update_own
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create trigger user_preferences_handle_updated_at
before update on public.user_preferences
for each row
execute function public.handle_updated_at();

grant select, insert, update on public.user_preferences to authenticated;