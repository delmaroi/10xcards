-- Atomic RPC to reset all learning progress for a set.
-- Resets FSRS state on every flashcard in the set to schema defaults and
-- deletes the set's review history, in one transaction.
-- Runs as SECURITY DEFINER because reviews has no DELETE RLS policy;
-- ownership is enforced explicitly via the p_user_id guard below.
create or replace function public.reset_set_progress(
  p_set_id  uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.sets where id = p_set_id and user_id = p_user_id) then
    raise exception 'Set not found or access denied';
  end if;

  delete from public.reviews
  where flashcard_id in (select id from public.flashcards where set_id = p_set_id);

  update public.flashcards
  set
    due            = now(),
    stability      = 0,
    difficulty     = 0,
    elapsed_days   = 0,
    scheduled_days = 0,
    learning_steps = 0,
    reps           = 0,
    lapses         = 0,
    state          = 0,
    last_review    = null
  where set_id = p_set_id;
end;
$$;

grant execute on function public.reset_set_progress to authenticated;
