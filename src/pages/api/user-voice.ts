import type { APIRoute } from "astro";
import { z } from "zod";
import { getUserVoices, upsertUserVoices } from "@/lib/services/user-settings";
import { isValidVoice } from "@/lib/tts/voices";

export const prerender = false;

const putSchema = z.object({
  front: z.string().refine(isValidVoice, { message: "Invalid front voice" }),
  back: z.string().refine(isValidVoice, { message: "Invalid back voice" }),
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

  const { data, error } = await getUserVoices(supabase, user.id);
  if (error) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ front: data.front, back: data.back }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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

  const { data, error } = await upsertUserVoices(supabase, user.id, {
    front: parsed.data.front,
    back: parsed.data.back,
  });
  if (error) {
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ front: data.front, back: data.back }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
