import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateFlashcardProposals, parseProposals, getAiErrorHttpStatus, REQUEST_TIMEOUT_MS } from "./ai";

function makeOpenRouterResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

function makeToolCallResponse(calls: { id: string; name: string; args: Record<string, unknown> }[]) {
  return {
    choices: [
      {
        message: {
          content: null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        },
      },
    ],
  };
}

const DICTIONARY_TOOL = {
  type: "function" as const,
  function: {
    name: "lookup_word",
    description: "Look up an English word.",
    parameters: {
      type: "object",
      properties: { word: { type: "string" } },
      required: ["word"],
    },
  },
};

const SAMPLE_TEXT = "This is a sample text long enough to pass the minimum length validation rule in the service.";

interface RequestBody {
  model: string;
  temperature: number;
  messages: { role: string; content: string | null }[];
  tools?: unknown[];
}

function bodyOf(fetchMock: ReturnType<typeof vi.mocked<typeof fetch>>, callIndex: number): RequestBody {
  const init = fetchMock.mock.calls[callIndex][1];
  return JSON.parse((init?.body ?? "{}") as string) as RequestBody;
}

describe("parseProposals", () => {
  it("parses raw JSON proposals", () => {
    const raw = JSON.stringify({
      flashcards: [{ front: "What is vitest?", back: "A fast unit test runner." }],
    });
    const { data, error } = parseProposals(raw);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({ front: "What is vitest?", back: "A fast unit test runner." });
  });

  it("strips markdown fences and parses", () => {
    const raw = "```json\n" + JSON.stringify({ flashcards: [{ front: "Q", back: "A" }] }) + "\n```";
    const { data, error } = parseProposals(raw);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("strips a bare language tag prefix and parses (gemini-flash-lite quirk)", () => {
    const raw = "json\n" + JSON.stringify({ flashcards: [{ front: "Q", back: "A" }] }) + "\n";
    const { data, error } = parseProposals(raw);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("recovers JSON wrapped in surrounding prose", () => {
    const raw = 'Here are your flashcards:\n{"flashcards":[{"front":"Q","back":"A"}]}\nHope that helps!';
    const { data, error } = parseProposals(raw);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("returns parseError for invalid JSON", () => {
    const { data, error } = parseProposals("not-json");
    expect(data).toHaveLength(0);
    expect(error?.kind).toBe("parseError");
  });

  it("returns noProposals for empty flashcards", () => {
    const raw = JSON.stringify({ flashcards: [] });
    const { data, error } = parseProposals(raw);
    expect(data).toHaveLength(0);
    expect(error?.kind).toBe("noProposals");
  });
});

describe("generateFlashcardProposals", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns proposals when OpenRouter responds with valid JSON", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          makeOpenRouterResponse(
            JSON.stringify({
              flashcards: [
                { front: "Front 1", back: "Back 1" },
                { front: "Front 2", back: "Back 2" },
              ],
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const { data, error } = await generateFlashcardProposals({
      text: "This is a sample text long enough to pass the minimum length validation rule in the service.",
      count: 2,
      apiKey: "test-key",
      model: "test/model",
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns apiError on non-ok response", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response("Bad request", { status: 400 }));

    const { data, error } = await generateFlashcardProposals({
      text: "This is a sample text long enough to pass the minimum length validation rule in the service.",
      count: 2,
      apiKey: "test-key",
      model: "test/model",
    });
    expect(data).toHaveLength(0);
    expect(error?.kind).toBe("apiError");
  });

  it("returns timeout on AbortError", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortError);

    const { data, error } = await generateFlashcardProposals({
      text: "This is a sample text long enough to pass the minimum length validation rule in the service.",
      count: 2,
      apiKey: "test-key",
      model: "test/model",
    });
    expect(data).toHaveLength(0);
    expect(error?.kind).toBe("timeout");
  });

  it("returns unconfigured when API key is missing", async () => {
    const { data, error } = await generateFlashcardProposals({
      text: "This is a sample text long enough to pass the minimum length validation rule in the service.",
      count: 2,
      apiKey: "",
    });
    expect(data).toHaveLength(0);
    expect(error?.kind).toBe("unconfigured");
  });
});

describe("generateFlashcardProposals — function calling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("executes tool calls then returns final content", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(makeToolCallResponse([{ id: "call_1", name: "lookup_word", args: { word: "x" } }])),
          {
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(makeOpenRouterResponse(JSON.stringify({ flashcards: [{ front: "Q", back: "A" }] }))),
          {
            status: 200,
          },
        ),
      );

    const onToolCall = vi.fn().mockResolvedValue(JSON.stringify([{ definition: "An unknown thing." }]));

    const { data, error } = await generateFlashcardProposals({
      text: SAMPLE_TEXT,
      count: 1,
      apiKey: "test-key",
      tools: [DICTIONARY_TOOL],
      onToolCall,
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith("lookup_word", { word: "x" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second request must include the assistant tool_calls turn + tool result.
    const secondBody = bodyOf(fetchMock, 1);
    const roles = secondBody.messages.map((m) => m.role);
    expect(roles).toContain("assistant");
    expect(roles).toContain("tool");
    expect(secondBody.tools).toHaveLength(1);
  });

  it("feeds tool error JSON back to the LLM and still resolves", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(makeToolCallResponse([{ id: "call_1", name: "lookup_word", args: { word: "x" } }])),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(makeOpenRouterResponse(JSON.stringify({ flashcards: [{ front: "Q", back: "A" }] }))),
          {
            status: 200,
          },
        ),
      );

    const onToolCall = vi.fn().mockResolvedValue(JSON.stringify({ error: "Dictionary lookup failed" }));

    const { data, error } = await generateFlashcardProposals({
      text: SAMPLE_TEXT,
      count: 1,
      apiKey: "test-key",
      tools: [DICTIONARY_TOOL],
      onToolCall,
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const toolMessage = bodyOf(fetchMock, 1).messages.find((m) => m.role === "tool");
    expect(toolMessage?.content).toContain("Dictionary lookup failed");
  });

  it("returns apiError when max tool-call rounds are exceeded", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    // Return a fresh Response per call — a single Response body can only be read once.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(makeToolCallResponse([{ id: "call_1", name: "lookup_word", args: { word: "x" } }])),
          { status: 200 },
        ),
      ),
    );

    const onToolCall = vi.fn().mockResolvedValue(JSON.stringify([]));

    const { data, error } = await generateFlashcardProposals({
      text: SAMPLE_TEXT,
      count: 1,
      apiKey: "test-key",
      tools: [DICTIONARY_TOOL],
      onToolCall,
    });

    expect(data).toHaveLength(0);
    expect(error?.kind).toBe("apiError");
    expect(fetchMock).toHaveBeenCalledTimes(8);
    // Final turn drops tools to force a non-tool answer.
    expect(bodyOf(fetchMock, 7).tools).toBeUndefined();
    expect(bodyOf(fetchMock, 6).tools).toBeDefined();
  });

  it("does not send tools and stays single-turn when no tools provided (regression)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeOpenRouterResponse(JSON.stringify({ flashcards: [{ front: "Q", back: "A" }] }))),
        {
          status: 200,
        },
      ),
    );

    const { data, error } = await generateFlashcardProposals({
      text: SAMPLE_TEXT,
      count: 1,
      apiKey: "test-key",
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock, 0).tools).toBeUndefined();
  });
});

describe("REQUEST_TIMEOUT_MS (NFR contract)", () => {
  it("keeps the whole-request generation deadline within the <10s NFR", () => {
    expect(REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
});

describe("getAiErrorHttpStatus", () => {
  it.each([
    [{ kind: "unconfigured", message: "x" }, 500],
    [{ kind: "apiError", message: "x" }, 502],
    [{ kind: "timeout", message: "x" }, 504],
    [{ kind: "parseError", message: "x" }, 422],
    [{ kind: "noProposals", message: "x" }, 422],
  ] as const)("maps %s to status %i", (error, expected) => {
    expect(getAiErrorHttpStatus(error)).toBe(expected);
  });
});
