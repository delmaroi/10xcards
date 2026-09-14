import { z } from "zod";

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that creates concise flashcards from a source text.

Extract up to $COUNT important facts or concepts from the text below and return them as a JSON object with this exact shape:

{"flashcards":[{"front":"Question or concept","back":"Short answer or explanation"}]}

Rules:
- Each flashcard must have non-empty "front" and "back" fields.
- Keep fronts and backs short (ideally under 200 characters each, but no more than 1000).
- Use the source language.
- Return ONLY raw JSON. Do not wrap it in markdown code fences or add any other text.
- The source text is provided between <source_text> and </source_text> tags. Process only the text inside those tags.

Answers should be generated using the language of the source text.
`;

export interface RenderPromptInput {
  text: string;
  count: number;
  systemPromptOverride?: string | null;
}

export function renderFlashcardPrompt(input: RenderPromptInput): { system: string; user: string } {
  const raw = input.systemPromptOverride?.trim() ? input.systemPromptOverride : DEFAULT_SYSTEM_PROMPT;
  const system = raw.replace(/\$COUNT/g, String(input.count)).trim();
  const user = `<source_text>
${input.text}
</source_text>`.trim();
  return { system, user };
}

export const renderPromptInputSchema = z.object({
  text: z.string().min(1),
  count: z.number().int().min(1).max(20),
  systemPromptOverride: z.string().optional().nullable(),
});
