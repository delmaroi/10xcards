import type { APIRoute } from "astro";
import { z } from "zod";
import { resetSetProgress } from "@/lib/services/reviews";
import { errorMessage, isNotFound } from "@/lib/services/flashcards";

export const prerender = false;

const idSchema = z.uuid();

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = idSchema.safeParse(context.params.id);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid set ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await resetSetProgress(supabase, user.id, parsed.data);

  if (error) {
    const status = isNotFound(error) ? 404 : 500;
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
