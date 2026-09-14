import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Flashcard } from "@/types";

export const flashcardContentSchema = z.object({
  front: z.string().min(1, "Front is required").max(1000, "Front must be 1000 characters or less"),
  back: z.string().min(1, "Back is required").max(1000, "Back must be 1000 characters or less"),
});

export type FlashcardContent = z.infer<typeof flashcardContentSchema>;

export type ServiceError =
  | { kind: "notFound"; message: string }
  | { kind: "clientUnavailable"; message: string }
  | { kind: "dbError"; message: string }
  | { kind: "validationError"; message: string };

export function errorMessage(error: ServiceError): string {
  return error.message;
}

export function isNotFound(error: ServiceError): boolean {
  return error.kind === "notFound";
}

export async function checkDuplicateFronts(
  client: SupabaseClient | null,
  setId: string,
): Promise<{ normalizedFronts: Set<string>; error: ServiceError | null }> {
  if (!client) {
    return {
      normalizedFronts: new Set(),
      error: { kind: "clientUnavailable", message: "Supabase client not available" },
    };
  }

  const result = await client.from("flashcards").select("front").eq("set_id", setId);
  if (result.error) {
    return {
      normalizedFronts: new Set(),
      error: { kind: "dbError", message: result.error.message },
    };
  }

  const rows = result.data as { front: string }[] | null;
  const normalizedFronts = new Set((rows ?? []).map((row) => row.front.trim().toLowerCase()));
  return { normalizedFronts, error: null };
}

export async function createFlashcard(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
  content: FlashcardContent,
): Promise<{ data: Flashcard | null; error: ServiceError | null }> {
  if (!client) return { data: null, error: { kind: "clientUnavailable", message: "Supabase client not available" } };

  const setResult = await client.from("sets").select("id").eq("id", setId).eq("user_id", userId).maybeSingle();
  if (setResult.error) return { data: null, error: { kind: "dbError", message: setResult.error.message } };
  if (!setResult.data) return { data: null, error: { kind: "notFound", message: "Set not found" } };

  const { normalizedFronts, error: duplicateError } = await checkDuplicateFronts(client, setId);
  if (duplicateError) return { data: null, error: duplicateError };

  if (normalizedFronts.has(content.front.trim().toLowerCase())) {
    return {
      data: null,
      error: { kind: "validationError", message: "A flashcard with this front text already exists in this set." },
    };
  }

  const result = await client
    .from("flashcards")
    .insert({ set_id: setId, front: content.front, back: content.back })
    .select()
    .single();

  if (result.error) return { data: null, error: { kind: "dbError", message: result.error.message } };
  return { data: result.data as Flashcard, error: null };
}

export async function createFlashcardsBulk(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
  contents: FlashcardContent[],
): Promise<{ data: Flashcard[] | null; skippedCount: number; skippedFronts: string[]; error: ServiceError | null }> {
  if (!client) {
    return {
      data: null,
      skippedCount: 0,
      skippedFronts: [],
      error: { kind: "clientUnavailable", message: "Supabase client not available" },
    };
  }

  const setResult = await client.from("sets").select("id").eq("id", setId).eq("user_id", userId).maybeSingle();
  if (setResult.error) {
    return {
      data: null,
      skippedCount: 0,
      skippedFronts: [],
      error: { kind: "dbError", message: setResult.error.message },
    };
  }
  if (!setResult.data) {
    return {
      data: null,
      skippedCount: 0,
      skippedFronts: [],
      error: { kind: "notFound", message: "Set not found" },
    };
  }

  if (contents.length === 0) {
    return { data: [], skippedCount: 0, skippedFronts: [], error: null };
  }

  if (contents.length > 50) {
    return {
      data: null,
      skippedCount: 0,
      skippedFronts: [],
      error: { kind: "validationError", message: "Cannot save more than 50 flashcards at once" },
    };
  }

  const { normalizedFronts, error: duplicateError } = await checkDuplicateFronts(client, setId);
  if (duplicateError) {
    return { data: null, skippedCount: 0, skippedFronts: [], error: duplicateError };
  }

  const skippedFronts: string[] = [];
  const uniqueContents = contents.filter((content) => {
    if (normalizedFronts.has(content.front.trim().toLowerCase())) {
      skippedFronts.push(content.front);
      return false;
    }
    return true;
  });

  if (uniqueContents.length === 0) {
    return { data: [], skippedCount: contents.length, skippedFronts, error: null };
  }

  const result = await client
    .from("flashcards")
    .insert(uniqueContents.map((content) => ({ set_id: setId, front: content.front, back: content.back })))
    .select();

  if (result.error) {
    return {
      data: null,
      skippedCount: 0,
      skippedFronts: [],
      error: { kind: "dbError", message: result.error.message },
    };
  }
  return { data: result.data as Flashcard[], skippedCount: skippedFronts.length, skippedFronts, error: null };
}

export async function updateFlashcard(
  client: SupabaseClient | null,
  userId: string,
  flashcardId: string,
  content: FlashcardContent,
): Promise<{ data: Flashcard | null; error: ServiceError | null }> {
  if (!client) return { data: null, error: { kind: "clientUnavailable", message: "Supabase client not available" } };

  const accessResult = await client
    .from("flashcards")
    .select("id, sets!inner(user_id)")
    .eq("id", flashcardId)
    .eq("sets.user_id", userId)
    .maybeSingle();

  if (accessResult.error) return { data: null, error: { kind: "dbError", message: accessResult.error.message } };
  if (!accessResult.data) return { data: null, error: { kind: "notFound", message: "Flashcard not found" } };

  const result = await client
    .from("flashcards")
    .update({ front: content.front, back: content.back })
    .eq("id", flashcardId)
    .select()
    .single();

  if (result.error) return { data: null, error: { kind: "dbError", message: result.error.message } };
  if (!result.data) return { data: null, error: { kind: "notFound", message: "Flashcard not found" } };
  return { data: result.data as Flashcard, error: null };
}

export async function deleteFlashcard(
  client: SupabaseClient | null,
  userId: string,
  flashcardId: string,
): Promise<{ error: ServiceError | null }> {
  if (!client) return { error: { kind: "clientUnavailable", message: "Supabase client not available" } };

  const accessResult = await client
    .from("flashcards")
    .select("id, sets!inner(user_id)")
    .eq("id", flashcardId)
    .eq("sets.user_id", userId)
    .maybeSingle();

  if (accessResult.error) return { error: { kind: "dbError", message: accessResult.error.message } };
  if (!accessResult.data) return { error: { kind: "notFound", message: "Flashcard not found" } };

  const result = await client.from("flashcards").delete().eq("id", flashcardId).select("id");

  if (result.error) return { error: { kind: "dbError", message: result.error.message } };
  if (result.data.length === 0) return { error: { kind: "notFound", message: "Flashcard not found" } };
  return { error: null };
}
