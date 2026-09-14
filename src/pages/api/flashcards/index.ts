import type { APIRoute } from "astro";
import { createFlashcard, flashcardContentSchema, errorMessage, isNotFound } from "@/lib/services/flashcards";
import { z } from "zod";

export const prerender = false;

const createFlashcardBodySchema = z.object({
  set_id: z.string().min(1, "Set ID is required"),
  front: flashcardContentSchema.shape.front,
  back: flashcardContentSchema.shape.back,
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

  const parsed = createFlashcardBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data, error } = await createFlashcard(supabase, user.id, parsed.data.set_id, {
    front: parsed.data.front,
    back: parsed.data.back,
  });

  if (error) {
    const status = isNotFound(error) ? 404 : error.kind === "validationError" ? 400 : 500;
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
