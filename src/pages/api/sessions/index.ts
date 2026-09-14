import type { APIRoute } from "astro";
import { z } from "zod";
import { logSession } from "@/lib/services/stats";
import { errorMessage, isNotFound } from "@/lib/services/flashcards";

export const prerender = false;

const sessionBodySchema = z.object({
  setId: z.uuid(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
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

  const parsed = sessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        details: parsed.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { setId, startedAt, endedAt } = parsed.data;

  if (new Date(endedAt) <= new Date(startedAt)) {
    return new Response(JSON.stringify({ error: "endedAt must be after startedAt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await logSession(supabase, user.id, setId, new Date(startedAt), new Date(endedAt));

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
