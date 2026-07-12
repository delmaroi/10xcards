-- F-02: minimal per-user flashcard persistence.
-- Single implicit deck — flashcards belong directly to their owner.
-- Row-Level Security isolates every row to auth.uid() = user_id (the data-isolation guardrail).

-- moddatetime keeps updated_at current on UPDATE (provided by Supabase in the extensions schema).
create extension if not exists moddatetime schema extensions;

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  front text not null,
  back text not null,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  review_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flashcards_user_id_idx on public.flashcards (user_id);

create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row
  execute function extensions.moddatetime (updated_at);

-- RLS: enable AND add per-operation owner policies. Enabling without policies denies all;
-- policies without enabling are ignored. (select auth.uid()) is wrapped per Supabase perf guidance.
alter table public.flashcards enable row level security;

create policy "Flashcards are selectable by owner"
  on public.flashcards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Flashcards are insertable by owner"
  on public.flashcards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Flashcards are updatable by owner"
  on public.flashcards
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Flashcards are deletable by owner"
  on public.flashcards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
