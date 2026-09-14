import type { SupabaseClient } from "@supabase/supabase-js";
import { fsrs } from "ts-fsrs";
import type { Grade } from "ts-fsrs";
import type { Flashcard } from "@/types";
import type { ServiceError } from "./flashcards";

export async function getDueCardsForSession(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
): Promise<{ data: { cards: Flashcard[]; nextDue: string | null } | null; error: ServiceError | null }> {
  if (!client) return { data: null, error: { kind: "clientUnavailable", message: "Supabase client not available" } };

  const setResult = await client.from("sets").select("id").eq("id", setId).eq("user_id", userId).maybeSingle();
  if (setResult.error) return { data: null, error: { kind: "dbError", message: setResult.error.message } };
  if (!setResult.data) return { data: null, error: { kind: "notFound", message: "Set not found" } };

  const now = new Date().toISOString();

  const result = await client
    .from("flashcards")
    .select("*")
    .eq("set_id", setId)
    .lte("due", now)
    .order("due", { ascending: true })
    .limit(100);

  if (result.error) return { data: null, error: { kind: "dbError", message: result.error.message } };

  const cards = result.data as Flashcard[];

  if (cards.length > 0) {
    return { data: { cards, nextDue: null }, error: null };
  }

  const nextResult = await client
    .from("flashcards")
    .select("due")
    .eq("set_id", setId)
    .order("due", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextResult.error) return { data: null, error: { kind: "dbError", message: nextResult.error.message } };

  const nextDue: string | null = nextResult.data ? String(nextResult.data.due) : null;
  return { data: { cards: [], nextDue }, error: null };
}

export async function submitCardReview(
  client: SupabaseClient | null,
  userId: string,
  flashcardId: string,
  grade: Grade,
): Promise<{ error: ServiceError | null }> {
  if (!client) return { error: { kind: "clientUnavailable", message: "Supabase client not available" } };

  const cardResult = await client
    .from("flashcards")
    .select("*, sets!inner(user_id)")
    .eq("id", flashcardId)
    .eq("sets.user_id", userId)
    .maybeSingle();

  if (cardResult.error) return { error: { kind: "dbError", message: cardResult.error.message } };
  if (!cardResult.data) return { error: { kind: "notFound", message: "Flashcard not found" } };

  const flashcard = cardResult.data as Flashcard;

  const f = fsrs();
  const card = {
    due: new Date(flashcard.due),
    stability: flashcard.stability,
    difficulty: flashcard.difficulty,
    elapsed_days: flashcard.elapsed_days,
    scheduled_days: flashcard.scheduled_days,
    learning_steps: flashcard.learning_steps,
    reps: flashcard.reps,
    lapses: flashcard.lapses,
    state: flashcard.state,
    last_review: flashcard.last_review ? new Date(flashcard.last_review) : undefined,
  };

  const now = new Date();
  const result = f.next(card, now, grade);

  const rpcResult = await client.rpc("submit_card_review", {
    p_flashcard_id: flashcardId,
    p_user_id: userId,
    p_grade: result.log.rating,
    p_state: result.log.state,
    p_due: result.log.due.toISOString(),
    p_stability: result.log.stability,
    p_difficulty: result.log.difficulty,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    p_elapsed_days: result.log.elapsed_days,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    p_last_elapsed_days: result.log.last_elapsed_days,
    p_scheduled_days: result.log.scheduled_days,
    p_learning_steps: result.card.learning_steps,
    p_review: result.log.review.toISOString(),
    p_new_due: result.card.due.toISOString(),
    p_new_stability: result.card.stability,
    p_new_difficulty: result.card.difficulty,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    p_new_elapsed_days: result.card.elapsed_days,
    p_new_scheduled_days: result.card.scheduled_days,
    p_new_reps: result.card.reps,
    p_new_lapses: result.card.lapses,
    p_new_state: result.card.state,
    p_new_learning_steps: result.card.learning_steps,
    p_new_last_review: result.log.review.toISOString(),
  });

  if (rpcResult.error) return { error: { kind: "dbError", message: rpcResult.error.message } };

  return { error: null };
}

export async function resetSetProgress(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
): Promise<{ error: ServiceError | null }> {
  if (!client) return { error: { kind: "clientUnavailable", message: "Supabase client not available" } };

  const rpcResult = await client.rpc("reset_set_progress", {
    p_set_id: setId,
    p_user_id: userId,
  });

  if (rpcResult.error) {
    // reset_set_progress is SECURITY DEFINER and raises
    // 'Set not found or access denied' when the caller does not own the set
    // (the guard bypasses RLS). Map that ownership rejection to a not-found
    // signal so the endpoint hides the resource with 404 — consistent with the
    // sibling endpoints and the documented OpenAPI contract — rather than 500.
    if (/not found|access denied/i.test(rpcResult.error.message)) {
      return { error: { kind: "notFound", message: "Set not found" } };
    }
    return { error: { kind: "dbError", message: rpcResult.error.message } };
  }

  return { error: null };
}
