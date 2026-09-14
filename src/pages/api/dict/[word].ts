import type { APIRoute } from "astro";
import { lookupWord } from "@/lib/services/dictionary";
import { checkDictRateLimit } from "@/lib/services/ai-rate-limit";
import { env } from "cloudflare:workers";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const word = context.params.word?.trim() ?? "";
  if (!word) {
    return new Response(JSON.stringify({ error: "Word is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const kv = env.AI_RATE_LIMIT as KVNamespace | undefined;
  const rateLimit = await checkDictRateLimit(kv ?? null, user.id);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  let entries;
  try {
    entries = await lookupWord(word);
  } catch {
    // Cambridge fetch failed (network/timeout). Per plan: single attempt, no
    // retry — surface as 502 so the caller knows the upstream is unavailable.
    return new Response(JSON.stringify({ error: "Dictionary service unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ word, entries }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
