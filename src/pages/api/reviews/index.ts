import type { APIRoute } from "astro";
import { z } from "zod";
import { Rating } from "@/types";
import { submitCardReview } from "@/lib/services/reviews";
import { errorMessage, isNotFound } from "@/lib/services/flashcards";

export const prerender = false;

const reviewBodySchema = z.object({
  flashcardId: z.uuid(),
  grade: z.union([z.literal(Rating.Again), z.literal(Rating.Hard), z.literal(Rating.Good), z.literal(Rating.Easy)]),
});

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = reviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { error } = await submitCardReview(supabase, user.id, parsed.data.flashcardId, parsed.data.grade);

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
