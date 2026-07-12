import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

// Google OAuth init (FR-001 SSO). Runs server-side through the SSR client so the
// PKCE code-verifier lands in cookies; the callback reads it to exchange the code.
export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${context.url.origin}/api/auth/callback` },
  });

  if (error || !data.url) {
    return context.redirect(
      `/auth/signin?error=${encodeURIComponent(error?.message ?? "Could not start Google sign-in")}`,
    );
  }

  return context.redirect(data.url);
};
