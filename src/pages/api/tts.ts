/// <reference types="@cloudflare/workers-types" />
import type { APIRoute } from "astro";
import { z } from "zod";
import { synthesizeSpeech, getTtsErrorHttpStatus, ttsErrorMessage } from "@/lib/services/tts";
import { checkTtsRateLimit } from "@/lib/services/ai-rate-limit";
import { getVoiceById, isValidVoice } from "@/lib/tts/voices";
import { getSecret } from "astro:env/server";
import { env } from "cloudflare:workers";

export const prerender = false;

const bodySchema = z.object({
  text: z.string().min(1).max(1000),
  voice: z.string().refine(isValidVoice, { message: "Invalid voice" }),
});

// `caches` is a Workers global (also present in workerd). It does not exist in
// the Node test environment, so guard access — caching is a best-effort layer.
function getEdgeCache(): Cache | null {
  if (typeof caches === "undefined") return null;
  // `caches.default` is a Cloudflare extension not present in the DOM lib types.
  return (caches as unknown as { default: Cache }).default;
}

async function cacheKeyRequest(text: string, voice: string): Promise<Request> {
  const data = new TextEncoder().encode(`${text}␟${voice}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Cache API keys are Requests; wrap the content hash in a synthetic URL.
  return new Request(`https://tts.local/${hex}`);
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "VALIDATION_FAILED", details: parsed.error.issues.map((i) => i.message) }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const voice = getVoiceById(parsed.data.voice);
  if (!voice) {
    // Unreachable after zod refine, but keeps the type narrowed.
    return new Response(JSON.stringify({ error: "VALIDATION_FAILED" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cache lookup BEFORE the rate-limit counter and the provider call, so cached
  // hits neither consume quota nor count against the limit.
  const cache = getEdgeCache();
  const cacheKey = await cacheKeyRequest(parsed.data.text, parsed.data.voice);
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      return hit;
    }
  }

  const kv = env.AI_RATE_LIMIT as KVNamespace | undefined;
  const rateLimit = await checkTtsRateLimit(kv ?? null, user.id);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  const apiKey = getSecret("GOOGLE_TTS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Text-to-speech is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await synthesizeSpeech({
    text: parsed.data.text,
    gcpVoice: voice.gcpVoice,
    languageCode: voice.languageCode,
    apiKey,
  });

  if (error || !data) {
    const status = error ? getTtsErrorHttpStatus(error) : 502;
    return new Response(
      JSON.stringify({ error: error ? ttsErrorMessage(error) : "No audio returned", kind: error?.kind }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const response = new Response(data as Uint8Array<ArrayBuffer>, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
  });

  if (cache) {
    await cache.put(cacheKey, response.clone());
  }

  return response;
};
