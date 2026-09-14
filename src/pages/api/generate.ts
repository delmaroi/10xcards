import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY } from "astro:env/server";
import { handleGenerateRequest } from "@/lib/generate-request";

// Thin wrapper: read the user (from middleware) + the server-only key, delegate to the
// framework-free handler, and serialize. The raw source text is never persisted or logged.
export const POST: APIRoute = async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    // leave body undefined — handleGenerateRequest treats it as invalid input
  }

  const result = await handleGenerateRequest({
    userId: context.locals.user?.id ?? null,
    body,
    apiKey: OPENROUTER_API_KEY ?? "",
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
};
