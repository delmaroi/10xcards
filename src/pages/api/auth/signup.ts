import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=SUPABASE_NOT_CONFIGURED`);
  }
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const code = error.message.toLowerCase().includes("already") ? "EMAIL_ALREADY_REGISTERED" : "SERVER_ERROR";
    return context.redirect(`/auth/signup?error=${code}`);
  }

  return context.redirect("/auth/confirm-email");
};
