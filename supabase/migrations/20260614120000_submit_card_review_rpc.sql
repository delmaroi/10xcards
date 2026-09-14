-- Atomic RPC for submitting a card review.
-- Inserts a review log and updates the flashcard FSRS state in one transaction,
-- preventing partial-write inconsistency if one of the two operations fails.
-- Runs as security invoker (default): RLS policies on reviews and flashcards apply.
create or replace function public.submit_card_review(
  p_flashcard_id        uuid,
  p_user_id             uuid,
  -- review log fields
  p_grade               smallint,
  p_state               smallint,
  p_due                 timestamptz,
  p_stability           double precision,
  p_difficulty          double precision,
  p_elapsed_days        integer,
  p_last_elapsed_days   integer,
  p_scheduled_days      integer,
  p_learning_steps      integer,
  p_review              timestamptz,
  -- flashcard update fields
  p_new_due             timestamptz,
  p_new_stability       double precision,
  p_new_difficulty      double precision,
  p_new_elapsed_days    integer,
  p_new_scheduled_days  integer,
  p_new_reps            integer,
  p_new_lapses          integer,
  p_new_state           smallint,
  p_new_learning_steps  integer,
  p_new_last_review     timestamptz
)
returns void
language plpgsql
as $$
begin
  insert into public.reviews (
    flashcard_id,
    user_id,
    grade,
    state,
    due,
    stability,
    difficulty,
    elapsed_days,
    last_elapsed_days,
    scheduled_days,
    learning_steps,
    review
  ) values (
    p_flashcard_id,
    p_user_id,
    p_grade,
    p_state,
    p_due,
    p_stability,
    p_difficulty,
    p_elapsed_days,
    p_last_elapsed_days,
    p_scheduled_days,
    p_learning_steps,
    p_review
  );

  update public.flashcards
  set
    due            = p_new_due,
    stability      = p_new_stability,
    difficulty     = p_new_difficulty,
    elapsed_days   = p_new_elapsed_days,
    scheduled_days = p_new_scheduled_days,
    reps           = p_new_reps,
    lapses         = p_new_lapses,
    state          = p_new_state,
    learning_steps = p_new_learning_steps,
    last_review    = p_new_last_review
  where id = p_flashcard_id;

  if not found then
    raise exception 'Flashcard not found or access denied';
  end if;
end;
$$;

grant execute on function public.submit_card_review to authenticated;
