-- Initial schema for 10xCards (F-01)

create extension if not exists pgcrypto;

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  share_token uuid default null,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  front text not null,
  back text not null,
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0,
  last_review timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grade smallint not null,
  state smallint not null,
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null default 0,
  last_elapsed_days integer not null default 0,
  scheduled_days integer not null,
  learning_steps integer not null default 0,
  review timestamptz not null,
  created_at timestamptz not null default now()
);

create index sets_user_id_idx on public.sets(user_id);
create unique index sets_share_token_idx on public.sets(share_token);
create index flashcards_set_id_idx on public.flashcards(set_id);
create index reviews_flashcard_id_idx on public.reviews(flashcard_id);
create index reviews_user_id_idx on public.reviews(user_id);
create index reviews_flashcard_review_idx on public.reviews(flashcard_id, review);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sets_handle_updated_at
before update on public.sets
for each row
execute function public.handle_updated_at();

create trigger flashcards_handle_updated_at
before update on public.flashcards
for each row
execute function public.handle_updated_at();

alter table public.sets enable row level security;
alter table public.flashcards enable row level security;
alter table public.reviews enable row level security;

create policy sets_select_own
on public.sets
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy sets_insert_own
on public.sets
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy sets_update_own
on public.sets
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy sets_delete_own
on public.sets
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy sets_select_shared_anon
on public.sets
for select
to anon
using (share_token is not null);

create policy flashcards_select_own
on public.flashcards
for select
to authenticated
using (
  set_id in (
    select id from public.sets where user_id = (select auth.uid())
  )
);

create policy flashcards_insert_own
on public.flashcards
for insert
to authenticated
with check (
  set_id in (
    select id from public.sets where user_id = (select auth.uid())
  )
);

create policy flashcards_update_own
on public.flashcards
for update
to authenticated
using (
  set_id in (
    select id from public.sets where user_id = (select auth.uid())
  )
)
with check (
  set_id in (
    select id from public.sets where user_id = (select auth.uid())
  )
);

create policy flashcards_delete_own
on public.flashcards
for delete
to authenticated
using (
  set_id in (
    select id from public.sets where user_id = (select auth.uid())
  )
);

create policy flashcards_select_shared_anon
on public.flashcards
for select
to anon
using (
  set_id in (
    select id from public.sets where share_token is not null
  )
);

create policy reviews_select_own
on public.reviews
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy reviews_insert_own
on public.reviews
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.flashcards f
    join public.sets s on s.id = f.set_id
    where f.id = flashcard_id
      and s.user_id = (select auth.uid())
  )
);
