import { z } from "zod";
import { renderFlashcardPrompt } from "./ai-prompt";

const MAX_INPUT_LENGTH = 8000;
const MAX_SIDE_LENGTH = 1000;
const DEFAULT_COUNT = 5;
const MAX_COUNT = 20;
const DEFAULT_MODEL = "google/gemini-flash-1.5";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const REQUEST_TIMEOUT_MS = 10_000;
const MAX_TOOL_TURNS = 8;

export type AiServiceError =
  | { kind: "unconfigured"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "parseError"; message: string }
  | { kind: "apiError"; message: string }
  | { kind: "noProposals"; message: string };

export interface FlashcardProposal {
  front: string;
  back: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type OpenRouterMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface GenerateInput {
  text: string;
  count?: number;
  apiKey: string;
  model?: string;
  appUrl?: string;
  systemPromptOverride?: string | null;
  tools?: ToolDefinition[];
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<string>;
}

export const generateInputSchema = z.object({
  text: z.string().min(10, "Text must be at least 10 characters").max(MAX_INPUT_LENGTH, "Text is too long"),
  count: z.number().int().min(1).max(MAX_COUNT).default(DEFAULT_COUNT),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  appUrl: z.string().optional(),
  systemPromptOverride: z.string().optional().nullable(),
});

const openRouterResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullable(),
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              type: z.literal("function"),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .optional(),
      }),
    }),
  ),
});

const proposalsResponseSchema = z.object({
  flashcards: z.array(
    z.object({
      front: z.string().min(1).max(MAX_SIDE_LENGTH),
      back: z.string().min(1).max(MAX_SIDE_LENGTH),
    }),
  ),
});

const HTTP_STATUS_BY_ERROR_KIND: Record<AiServiceError["kind"], number> = {
  unconfigured: 500,
  apiError: 502,
  timeout: 504,
  parseError: 422,
  noProposals: 422,
};

export function getAiErrorHttpStatus(error: AiServiceError): number {
  return HTTP_STATUS_BY_ERROR_KIND[error.kind];
}

export function isAiServiceError(value: unknown): value is AiServiceError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof value.kind === "string" &&
    ["unconfigured", "timeout", "parseError", "apiError", "noProposals"].includes((value as { kind: string }).kind)
  );
}

export function errorMessage(error: AiServiceError): string {
  return error.message;
}

export function errorKind(error: AiServiceError): AiServiceError["kind"] {
  return error.kind;
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpening = trimmed.replace(/^```[a-zA-Z0-9]*\n?/, "");
    const withoutClosing = withoutOpening.replace(/\n?```$/, "");
    return withoutClosing.trim();
  }
  // Some models (notably gemini-2.5-flash-lite) prefix the payload with a bare
  // language tag like `json\n{...}` — a code fence that lost its backticks.
  // Strip a leading lone-word line that isn't itself the start of the JSON.
  const bareTag = /^[a-zA-Z]+\s*\n([[{][\s\S]*)$/.exec(trimmed);
  if (bareTag) {
    return bareTag[1].trim();
  }
  return trimmed;
}

// Last-resort recovery: pull the outermost JSON object out of a string that has
// leading/trailing prose the model added despite the "raw JSON only" instruction.
function extractJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return s.slice(start, end + 1);
}

export function parseProposals(rawContent: string): { data: FlashcardProposal[]; error: AiServiceError | null } {
  const cleaned = stripMarkdownFences(rawContent);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const extracted = extractJsonObject(cleaned);
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
      } catch {
        return { data: [], error: { kind: "parseError", message: "Failed to parse AI response as JSON" } };
      }
    } else {
      return { data: [], error: { kind: "parseError", message: "Failed to parse AI response as JSON" } };
    }
  }

  const validation = proposalsResponseSchema.safeParse(parsed);
  if (!validation.success) {
    return {
      data: [],
      error: { kind: "parseError", message: "AI response did not match expected format" },
    };
  }

  if (validation.data.flashcards.length === 0) {
    return { data: [], error: { kind: "noProposals", message: "No flashcards were generated" } };
  }

  return { data: validation.data.flashcards, error: null };
}

export async function generateFlashcardProposals(input: GenerateInput): Promise<{
  data: FlashcardProposal[];
  error: AiServiceError | null;
}> {
  const parsedInput = generateInputSchema.safeParse(input);
  if (!parsedInput.success) {
    const message = parsedInput.error.issues.map((issue) => issue.message).join("; ");
    return { data: [], error: { kind: "parseError", message } };
  }

  const { text, count, apiKey, model, appUrl, systemPromptOverride } = parsedInput.data;
  // `tools`/`onToolCall` carry a function value that zod strips during parsing,
  // so read them from the raw input rather than `parsedInput.data`.
  const { tools, onToolCall } = input;
  const useTools = Boolean(tools && tools.length > 0 && onToolCall);

  if (!apiKey) {
    return { data: [], error: { kind: "unconfigured", message: "OpenRouter API key is not configured" } };
  }

  const { system, user } = renderFlashcardPrompt({ text, count, systemPromptOverride });

  const messages: OpenRouterMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    // Multi-turn loop: re-request whenever the LLM asks for tool calls, feeding
    // the results back as `role: "tool"` messages, until it returns final
    // content or we hit the round-trip cap.
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const body: Record<string, unknown> = {
        model: model ?? DEFAULT_MODEL,
        messages,
        temperature: 0.3,
      };
      // On the final allowed turn, drop the tools so the model is forced to
      // emit its answer instead of requesting yet another lookup it can't make.
      if (useTools && turn < MAX_TOOL_TURNS - 1) {
        body.tools = tools;
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": appUrl ?? "https://10xcards.app",
          "X-Title": "10xCards",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        return {
          data: [],
          error: {
            kind: "apiError",
            message: `OpenRouter request failed (${response.status}): ${bodyText.slice(0, 200)}`,
          },
        };
      }

      const raw = await response.json();
      const parsedResponse = openRouterResponseSchema.safeParse(raw);
      if (!parsedResponse.success || parsedResponse.data.choices.length === 0) {
        return {
          data: [],
          error: { kind: "apiError", message: "OpenRouter returned an unexpected response format" },
        };
      }

      const message = parsedResponse.data.choices[0].message;
      const toolCalls = message.tool_calls;

      if (useTools && toolCalls && toolCalls.length > 0 && onToolCall) {
        // Echo the assistant turn (with its tool_calls) back into the
        // conversation, then resolve all calls concurrently and append the
        // results. Running them in parallel matters when the LLM requests many
        // lookups at once (up to 20 words) — each is an independent live scrape,
        // so serial awaits would stack their latency against the request timeout.
        messages.push({ role: "assistant", content: message.content, tool_calls: toolCalls });
        const results = await Promise.all(
          toolCalls.map(async (call) => {
            let args: Record<string, unknown> = {};
            try {
              const parsedArgs = JSON.parse(call.function.arguments) as unknown;
              if (parsedArgs && typeof parsedArgs === "object") {
                args = parsedArgs as Record<string, unknown>;
              }
            } catch {
              args = {};
            }
            return { id: call.id, content: await onToolCall(call.function.name, args) };
          }),
        );
        for (const { id, content } of results) {
          messages.push({ role: "tool", tool_call_id: id, content });
        }
        continue;
      }

      // No (more) tool calls — this is the final response. The schema makes
      // `content` nullable; a null here means the LLM produced neither text nor
      // a tool call, which we cannot parse into proposals.
      const content = message.content;
      if (content === null) {
        return { data: [], error: { kind: "apiError", message: "OpenRouter returned no content" } };
      }
      return parseProposals(content);
    }

    return {
      data: [],
      error: { kind: "apiError", message: "Exceeded maximum tool-call rounds without a final response" },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { data: [], error: { kind: "timeout", message: "AI generation timed out" } };
    }
    return {
      data: [],
      error: {
        kind: "apiError",
        message: error instanceof Error ? error.message : "Unknown error calling OpenRouter",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
