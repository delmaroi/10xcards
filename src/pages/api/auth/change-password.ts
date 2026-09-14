import type { APIRoute } from "astro";
import { z } from "zod";
import { changePassword } from "@/lib/services/user-settings";

export const prerender = false;

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !user.email || !supabase) {
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "VALIDATION_FAILED",
        details: parsed.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return new Response(JSON.stringify({ error: "CURRENT_PASSWORD_INCORRECT" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await changePassword(supabase, parsed.data.newPassword);
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
