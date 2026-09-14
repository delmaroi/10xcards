create table public.user_ai_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  flashcard_count integer null check (flashcard_count >= 1 and flashcard_count <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ai_prompts_user_id_key unique (user_id)
);

alter table public.user_ai_prompts enable row level security;

create policy user_ai_prompts_select_own
on public.user_ai_prompts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_ai_prompts_insert_own
on public.user_ai_prompts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy user_ai_prompts_update_own
on public.user_ai_prompts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_ai_prompts_delete_own
on public.user_ai_prompts
for delete
to authenticated
using ((select auth.uid()) = user_id);

create trigger user_ai_prompts_handle_updated_at
before update on public.user_ai_prompts
for each row
execute function public.handle_updated_at();

grant select, insert, update, delete on public.user_ai_prompts to authenticated;