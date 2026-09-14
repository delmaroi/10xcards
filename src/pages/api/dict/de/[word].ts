import type { APIRoute } from "astro";
import { lookupWordDe } from "@/lib/services/dictionary-de";
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
  // Reuse the Cambridge dict rate-limit bucket so EN and DE lookups share the
  // same 30/min per-user budget (see plan §Rate-limit strategy).
  const rateLimit = await checkDictRateLimit(kv ?? null, user.id);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  let entries;
  try {
    // Pass the KV namespace through so the service can read/write the 30-day
    // Pons cache (pons:de:<word>) — UI and AI-tool lookups share one cache.
    entries = await lookupWordDe(word, { kv: kv ?? null });
  } catch {
    // Covers: PONS_API_SECRET missing, Pons 4xx/5xx, timeout, network failure.
    // Per plan: single attempt, no retry — surface as 502.
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
