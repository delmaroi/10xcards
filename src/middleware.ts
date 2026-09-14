import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { getUserLocale } from "@/lib/services/user-settings";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isValidLocale } from "@/lib/i18n/constants";
import type { SupportedLocale } from "@/lib/i18n/constants";

const PROTECTED_PAGE_ROUTES = ["/dashboard", "/sets", "/generate", "/settings", "/lookup_word", "/lookup_word_de"];
const PROTECTED_API_ROUTES = [
  "/api/sets",
  "/api/flashcards",
  "/api/reviews",
  "/api/share",
  "/api/user-prompt",
  "/api/user-voice",
  "/api/tts",
  "/api/dict",
  "/api/auth/change-password",
  "/api/auth/delete-account",
];

function isProtected(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function resolveLocaleFromHeader(header: string | null): SupportedLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q, index };
    })
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) {
    if (isValidLocale(tag)) return tag;
    const base = tag.split("-")[0];
    if (isValidLocale(base)) return base;
  }
  return null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
    context.locals.supabase = supabase;
  } else {
    context.locals.user = null;
    context.locals.supabase = null;
  }

  let locale: SupportedLocale = DEFAULT_LOCALE;

  const cookieLocale = context.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale;
  } else if (context.locals.user && context.locals.supabase) {
    const { data } = await getUserLocale(context.locals.supabase, context.locals.user.id);
    if (data) {
      locale = data;
    }
  }

  if (locale === DEFAULT_LOCALE && (!cookieLocale || !isValidLocale(cookieLocale))) {
    const headerLocale = resolveLocaleFromHeader(context.request.headers.get("accept-language"));
    if (headerLocale) {
      locale = headerLocale;
    }
  }

  context.locals.locale = locale;

  if (!context.cookies.get(LOCALE_COOKIE)?.value) {
    context.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      sameSite: "lax",
      secure: true,
    });
  }

  if (!context.locals.user) {
    if (isProtected(context.url.pathname, PROTECTED_API_ROUTES)) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (isProtected(context.url.pathname, PROTECTED_PAGE_ROUTES)) {
      return context.redirect("/auth/signin");
    }
  }

  const response = await next();

  // Prevent bfcache for page responses (Cloudflare Workers Response is immutable —
  // must create a new Response to set headers)
  if (!context.url.pathname.startsWith("/api/")) {
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return response;
});
