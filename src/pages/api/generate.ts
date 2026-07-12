import type { APIRoute } from "astro";
import { OPENROUTER_KEY } from "astro:env/server";
import { handleGenerateRequest } from "@/lib/generate-request";

// Thin wrapper: read the user (from middleware) + the server-only key, delegate to the
// framework-free handler, and serialize. The raw source text is never persisted or logged.
export const POST: APIRoute = async (context) => {
  let body: unknown = null;
  try {
    body = await context.request.json();
  } catch {
    body = null;
  }

  const result = await handleGenerateRequest({
    userId: context.locals.user?.id ?? null,
    body,
    apiKey: OPENROUTER_KEY ?? "",
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
};
