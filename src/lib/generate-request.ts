import { z } from "zod";
import { generateFlashcards, type FlashcardProposal } from "@/lib/openrouter";

// Framework-free handler for the generation request (S-01). No astro:* imports, so it is
// unit-testable with plain Vitest. The thin API route (src/pages/api/generate.ts) reads
// the user + OPENROUTER_KEY from the Astro context and delegates here.

export interface GenerateResponse {
  status: number;
  body: { proposals: FlashcardProposal[] } | { error: string };
}

const requestSchema = z.object({ text: z.string() });

export async function handleGenerateRequest(input: {
  userId: string | null;
  body: unknown;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<GenerateResponse> {
  // Auth: an API caller gets a 401 JSON, not the middleware's HTML redirect.
  if (!input.userId) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const parsed = requestSchema.safeParse(input.body);
  if (!parsed.success) {
    return { status: 400, body: { error: "invalid_request" } };
  }

  const result = await generateFlashcards(parsed.data.text, input.apiKey, input.fetchImpl);
  if (result.ok) {
    return { status: 200, body: { proposals: result.proposals } };
  }
  // invalid_input (too short/long) → 400; provider/output failures → 502.
  const status = result.error === "invalid_input" ? 400 : 502;
  return { status, body: { error: result.error } };
}
