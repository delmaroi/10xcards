import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { isPublicRoute } from "@/lib/route-access";

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
