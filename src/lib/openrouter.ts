import { z } from "zod";

// OpenRouter flashcard generation (S-01). Framework-free: the API key and fetch are
// injected (not imported from astro:env), so this is unit-testable with plain Vitest
// and reusable on the Workers edge. The endpoint supplies the real key + global fetch.

export interface FlashcardProposal {
  front: string;
  back: string;
}

export type GenerateResult =
  | { ok: true; proposals: FlashcardProposal[] }
  | { ok: false; error: "invalid_input" | "provider_error" | "bad_output" };

// Provisional — see plan Open Questions. Model = Q1, input bounds = Q2 (PRD Open Q2).
const MODEL = "openai/gpt-4o-mini";
const MIN_INPUT = 20;
const MAX_INPUT = 10_000;

const SYSTEM_PROMPT = `You turn study text into flashcards. Return ONLY a JSON array of objects, each with "front" (a question) and "back" (its answer). No prose, no markdown code fences.`;

const proposalsSchema = z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1);

export async function generateFlashcards(
  sourceText: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GenerateResult> {
  const text = sourceText.trim();
  if (text.length < MIN_INPUT || text.length > MAX_INPUT) {
    return { ok: false, error: "invalid_input" };
  }
  if (!apiKey) return { ok: false, error: "provider_error" };

  let res: Response;
  try {
    res = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "provider_error" };
  }

  if (!res.ok) return { ok: false, error: "provider_error" };

  let content: string;
  try {
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    content = body.choices?.[0]?.message?.content ?? "";
  } catch {
    return { ok: false, error: "provider_error" };
  }

  // Trust nothing: strip optional markdown fences, JSON.parse, then validate the shape.
  let jsonValue: unknown;
  try {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    jsonValue = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "bad_output" };
  }

  const parsed = proposalsSchema.safeParse(jsonValue);
  if (!parsed.success) return { ok: false, error: "bad_output" };

  return { ok: true, proposals: parsed.data };
}
