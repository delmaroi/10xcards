-- S-04: success-metrics collection.
-- One row per saved generation-triage batch, so the PRD's AI acceptance-rate
-- (Σaccepted / Σgenerated) can be measured. AI-share is read from flashcards.source
-- and needs no table here. Row-Level Security isolates every row to its owner.

create table public.generation_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generated integer not null check (generated >= 0),
  accepted integer not null check (accepted >= 0),
  edited integer not null default 0 check (edited >= 0),
  created_at timestamptz not null default now()
);

create index generation_stats_user_id_idx on public.generation_stats (user_id);

-- RLS: enable AND add owner policies. Metrics are personal-scoped; a product-wide
-- roll-up (across users) is a service-role read, deferred (nice-to-have).
alter table public.generation_stats enable row level security;

create policy "Generation stats are insertable by owner"
  on public.generation_stats
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Generation stats are selectable by owner"
  on public.generation_stats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
