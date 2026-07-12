import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { handleSaveRequest } from "@/lib/save-flashcards";

// Thin wrapper: read the user (middleware) + SSR Supabase client, delegate to the
// framework-free handler, and pass a single atomic insert closure. RLS enforces ownership.
export const POST: APIRoute = async (context) => {
  let body: unknown = null;
  try {
    body = await context.request.json();
  } catch {
    body = null;
  }

  const supabase = createClient(context.request.headers, context.cookies);

  const result = await handleSaveRequest({
    userId: context.locals.user?.id ?? null,
    body,
    insertCards: async (rows) => {
      if (!supabase) return { error: new Error("supabase unavailable") };
      const { error } = await supabase.from("flashcards").insert(rows);
      return { error };
    },
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
};
