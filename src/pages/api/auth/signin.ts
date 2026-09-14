import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=SUPABASE_NOT_CONFIGURED`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const code = error.message.toLowerCase().includes("invalid") ? "INVALID_CREDENTIALS" : "SERVER_ERROR";
    return context.redirect(`/auth/signin?error=${code}`);
  }

  return context.redirect("/");
};
