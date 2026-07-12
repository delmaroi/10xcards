import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { handleUpdateCard, handleDeleteCard, type MutationResponse } from "@/lib/deck-mutations";

function toResponse(result: MutationResponse): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}

export const PATCH: APIRoute = async (context) => {
  let body: unknown = null;
  try {
    body = await context.request.json();
  } catch {
    body = null;
  }

  const supabase = createClient(context.request.headers, context.cookies);
  const result = await handleUpdateCard({
    userId: context.locals.user?.id ?? null,
    id: context.params.id ?? "",
    body,
    updateCard: async (id, patch) => {
      if (!supabase) return { ok: false, found: false };
      const { data, error } = await supabase.from("flashcards").update(patch).eq("id", id).select("id");
      if (error) return { ok: false, found: false };
      return { ok: true, found: data.length > 0 };
    },
  });
  return toResponse(result);
};

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  const result = await handleDeleteCard({
    userId: context.locals.user?.id ?? null,
    id: context.params.id ?? "",
    deleteCard: async (id) => {
      if (!supabase) return { ok: false, found: false };
      const { data, error } = await supabase.from("flashcards").delete().eq("id", id).select("id");
      if (error) return { ok: false, found: false };
      return { ok: true, found: data.length > 0 };
    },
  });
  return toResponse(result);
};
