import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { handleSubmitRating } from "@/lib/review-rating";
import type { ReviewState } from "@/lib/srs";

export const POST: APIRoute = async (context) => {
  let body: unknown = null;
  try {
    body = await context.request.json();
  } catch {
    body = null;
  }

  const supabase = createClient(context.request.headers, context.cookies);
  const result = await handleSubmitRating({
    userId: context.locals.user?.id ?? null,
    body,
    now: new Date(),
    // RLS scopes both reads and writes to the owner — a non-owner's id returns 0 rows.
    loadCard: async (id) => {
      if (!supabase) return { found: false, state: null };
      const { data, error } = await supabase.from("flashcards").select("review_state").eq("id", id);
      if (error || data.length === 0) return { found: false, state: null };
      return { found: true, state: (data[0].review_state as ReviewState | null) ?? null };
    },
    saveState: async (id, state) => {
      if (!supabase) return { ok: false };
      const { error } = await supabase.from("flashcards").update({ review_state: state }).eq("id", id);
      return { ok: !error };
    },
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
};
