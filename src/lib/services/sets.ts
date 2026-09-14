import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { FlashcardSet, Flashcard, DonatedSetTile } from "@/types";

export const setNameSchema = z
  .string()
  .min(1, "Set name is required")
  .max(200, "Set name must be 200 characters or less");

export type SetName = z.infer<typeof setNameSchema>;

export async function listSets(
  client: SupabaseClient | null,
  userId: string,
): Promise<{ data: FlashcardSet[] | null; error: string | null }> {
  if (!client) return { data: null, error: "Supabase client not available" };

  const result = await client.from("sets").select("*").eq("user_id", userId).order("updated_at", { ascending: false });

  if (result.error) return { data: null, error: result.error.message };
  return { data: result.data as FlashcardSet[], error: null };
}

export async function listSetsWithFlashcardCounts(
  client: SupabaseClient | null,
  userId: string,
): Promise<{ data: (FlashcardSet & { flashcard_count: number })[] | null; error: string | null }> {
  if (!client) return { data: null, error: "Supabase client not available" };

  const result = await client
    .from("sets")
    .select("*, flashcard_count:flashcards(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (result.error) return { data: null, error: result.error.message };

  const mapped = (result.data as (FlashcardSet & { flashcard_count?: { count: number }[] | number })[]).map((set) => ({
    ...set,
    flashcard_count: Array.isArray(set.flashcard_count)
      ? (set.flashcard_count[0]?.count ?? 0)
      : (set.flashcard_count ?? 0),
  })) as (FlashcardSet & { flashcard_count: number })[];

  return { data: mapped, error: null };
}

export async function createSet(
  client: SupabaseClient | null,
  userId: string,
  name: string,
): Promise<{ data: FlashcardSet | null; error: string | null }> {
  if (!client) return { data: null, error: "Supabase client not available" };

  const result = await client.from("sets").insert({ user_id: userId, name }).select().single();

  if (result.error) return { data: null, error: result.error.message };
  return { data: result.data as FlashcardSet, error: null };
}

export async function renameSet(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
  name: string,
): Promise<{ data: FlashcardSet | null; error: string | null }> {
  if (!client) return { data: null, error: "Supabase client not available" };

  const result = await client
    .from("sets")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", setId)
    .eq("user_id", userId)
    .select()
    // maybeSingle (not single): a non-owner / missing set matches 0 rows, and
    // .single() would surface that as a PGRST116 coercion error → 500. Treat the
    // empty result as not-found so the endpoint hides the resource with 404,
    // consistent with deleteSet and the documented OpenAPI contract.
    .maybeSingle();

  if (result.error) return { data: null, error: result.error.message };
  if (!result.data) return { data: null, error: "Set not found" };
  return { data: result.data as FlashcardSet, error: null };
}

export async function deleteSet(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
): Promise<{ error: string | null }> {
  if (!client) return { error: "Supabase client not available" };

  const result = await client.from("sets").delete().eq("id", setId).eq("user_id", userId).select("id");

  if (result.error) return { error: result.error.message };
  if (result.data.length === 0) return { error: "Set not found" };
  return { error: null };
}

export async function getSetWithFlashcards(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
): Promise<{
  data: { set: FlashcardSet; flashcards: Flashcard[] } | null;
  error: string | null;
}> {
  if (!client) return { data: null, error: "Supabase client not available" };

  const setResult = await client.from("sets").select("*").eq("id", setId).eq("user_id", userId).maybeSingle();

  if (setResult.error) return { data: null, error: setResult.error.message };
  if (!setResult.data) return { data: null, error: "Set not found" };

  const [fcResult, _lastOpenedResult] = await Promise.all([
    client.from("flashcards").select("*").eq("set_id", setId).order("created_at", { ascending: false }),
    client.from("sets").update({ last_opened_at: new Date().toISOString() }).eq("id", setId).eq("user_id", userId),
  ]);

  if (fcResult.error) return { data: null, error: fcResult.error.message };

  return {
    data: {
      set: setResult.data as FlashcardSet,
      flashcards: fcResult.data as Flashcard[],
    },
    error: null,
  };
}

export async function activateShareToken(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
): Promise<{ data: string | null; error: string | null }> {
  if (!client) return { data: null, error: "Supabase client not available" };

  // Atomic: only update if share_token is currently null — eliminates TOCTOU race.
  const result = await client
    .from("sets")
    .update({ share_token: crypto.randomUUID() })
    .eq("id", setId)
    .eq("user_id", userId)
    .is("share_token", null)
    .select("share_token")
    .maybeSingle();

  if (result.error) return { data: null, error: result.error.message };

  // Row updated — return the newly generated token.
  if (result.data) return { data: result.data.share_token as string, error: null };

  // No row updated: either the set doesn't exist or the token was already set by a concurrent request.
  const existing = await client.from("sets").select("share_token").eq("id", setId).eq("user_id", userId).maybeSingle();
  if (existing.error) return { data: null, error: existing.error.message };
  if (!existing.data) return { data: null, error: "Set not found" };
  return { data: existing.data.share_token as string, error: null };
}

export async function getDonatedSets(
  client: SupabaseClient | null,
): Promise<{ data: DonatedSetTile[] | null; error: string | null }> {
  if (!client) return { data: null, error: "Supabase client not available" };

  const result = await client.rpc("get_donated_sets_for_teacher");
  if (result.error) return { data: null, error: result.error.message };
  return { data: result.data as DonatedSetTile[], error: null };
}

export async function getSetByIdForUser(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
): Promise<{ data: FlashcardSet | null; error: string | null }> {
  if (!client) return { data: null, error: "Supabase client not available" };

  const result = await client.from("sets").select("*").eq("id", setId).eq("user_id", userId).maybeSingle();

  if (result.error) return { data: null, error: result.error.message };
  return { data: result.data as FlashcardSet, error: null };
}
