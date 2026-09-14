import type { APIRoute } from "astro";
import { z } from "zod";
import { createFlashcardsBulk, flashcardContentSchema } from "@/lib/services/flashcards";

export const prerender = false;

const batchBodySchema = z.object({
  flashcards: z
    .array(flashcardContentSchema)
    .min(1, "At least one flashcard is required")
    .max(50, "No more than 50 flashcards per batch"),
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

  const { id } = context.params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Set ID is required" }), {
      status: 400,
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

  const parsed = batchBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data, skippedCount, skippedFronts, error } = await createFlashcardsBulk(
    supabase,
    user.id,
    id,
    parsed.data.flashcards,
  );

  if (error) {
    const status = error.kind === "notFound" ? 404 : error.kind === "validationError" ? 400 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const responseBody: Record<string, unknown> = { data, count: data?.length ?? 0 };
  if (skippedCount > 0) {
    responseBody.skippedCount = skippedCount;
    responseBody.skippedFronts = skippedFronts;
  }

  return new Response(JSON.stringify(responseBody), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
