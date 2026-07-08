import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

// Default-deny gating: every route is protected EXCEPT the public allowlist below.
// New product routes are therefore gated automatically — no edit needed here.
const PUBLIC_EXACT = ["/"];
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/"];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  // Static assets must pass through untouched (never redirect them).
  if (pathname.startsWith("/_astro/")) return true;
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return true;
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  context.locals.user = null;
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      context.locals.user = user ?? null;
    } catch {
      // Auth provider unreachable — treat as unauthenticated so a Supabase
      // outage fails toward login on protected routes without 500-ing public ones.
      context.locals.user = null;
    }
  }

  if (!isPublicRoute(context.url.pathname) && !context.locals.user) {
    return context.redirect("/auth/signin");
  }

  // Authenticated users don't need the landing page — send them into the product.
  if (context.url.pathname === "/" && context.locals.user) {
    return context.redirect("/dashboard");
  }

  return next();
});
