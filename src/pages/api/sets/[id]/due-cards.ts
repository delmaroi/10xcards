import type { APIRoute } from "astro";
import { getDueCardsForSession } from "@/lib/services/reviews";
import { errorMessage, isNotFound } from "@/lib/services/flashcards";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = context.params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Set ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await getDueCardsForSession(supabase, user.id, id);

  if (error) {
    const status = isNotFound(error) ? 404 : 500;
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
