import type { APIRoute } from "astro";
import { z } from "zod";
import { getUserPrompt, upsertUserPrompt, deleteUserPrompt } from "@/lib/services/user-settings";

export const prerender = false;

const putSchema = z.object({
  prompt: z.string().min(1).max(10000),
  flashcard_count: z.number().int().min(1).max(20).nullable().optional(),
});

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await getUserPrompt(supabase, user.id);
  if (error) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ prompt: data?.prompt ?? null, flashcard_count: data?.flashcard_count ?? null }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

export const PUT: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "VALIDATION_FAILED",
        details: parsed.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data, error } = await upsertUserPrompt(
    supabase,
    user.id,
    parsed.data.prompt,
    parsed.data.flashcard_count ?? null,
  );
  if (error || !data) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ prompt: data.prompt, flashcard_count: data.flashcard_count }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await deleteUserPrompt(supabase, user.id);
  if (error) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
