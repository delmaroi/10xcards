import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

// OAuth callback (FR-001 SSO). Google redirects here with a `code`; exchange it for a
// session (using the PKCE verifier cookie set at init), then land on the dashboard.
export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const code = context.url.searchParams.get("code");
  if (!code) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Missing OAuth code")}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
