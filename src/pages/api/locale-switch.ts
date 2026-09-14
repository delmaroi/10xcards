import type { APIRoute } from "astro";
import { isValidLocale, LOCALE_COOKIE, DEFAULT_LOCALE } from "@/lib/i18n/constants";
import type { SupportedLocale } from "@/lib/i18n/constants";
import { upsertUserLocale } from "@/lib/services/user-settings";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const locale = (form.get("locale") as string | null) ?? "";
  const redirectParam = (form.get("redirect") as string | null) ?? "/settings";

  const safeLocale: SupportedLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  // Guard against open redirects
  const safeRedirect = redirectParam.startsWith("/") ? redirectParam : "/settings";

  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (user?.id && supabase) {
    await upsertUserLocale(supabase, user.id, safeLocale).catch((_err: unknown) => {
      // ignore — cookie already set
    });
  }

  // Explicitly build the Set-Cookie header to ensure it reaches the browser
  // even through Cloudflare Workers' response pipeline (context.cookies.set
  // may be dropped on redirect responses by the adapter)
  const cookieHeader = [
    `${LOCALE_COOKIE}=${safeLocale}`,
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 365}`,
    "SameSite=Lax",
    "Secure",
  ].join("; ");

  return new Response(null, {
    status: 302,
    headers: {
      Location: safeRedirect,
      "Set-Cookie": cookieHeader,
      "Cache-Control": "no-store",
    },
  });
};
