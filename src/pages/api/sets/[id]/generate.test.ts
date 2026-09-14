import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AiServiceError } from "@/lib/services/ai";

// Partial mock of the AI service: override ONLY `generateFlashcardProposals`
// (the provider boundary) so the REAL `getAiErrorHttpStatus` / `errorMessage` /
// `generateInputSchema` run — the error→status mapping under test must be the
// production one, not a stubbed table, or the test has no teeth.
vi.mock("@/lib/services/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/ai")>();
  return { ...actual, generateFlashcardProposals: vi.fn() };
});

// The node stub gives `env = {}`, so the route calls `checkRateLimit(null, …)`,
// which fails CLOSED (returns `{allowed:false}`) and would 429 every request.
// Mock the gate and default it to "allowed"; flip to denied only for the 429 case.
vi.mock("@/lib/services/ai-rate-limit", () => ({ checkRateLimit: vi.fn() }));

// No per-user prompt override in these tests.
vi.mock("@/lib/services/user-settings", () => ({ getUserPrompt: vi.fn() }));

// Auto-mock so we can assert `checkDuplicateFronts` is NEVER reached on the
// failure path (it lives past the AI-error early return).
vi.mock("@/lib/services/flashcards");

// Both dictionary services are mocked at the provider boundary so the tool
// dispatch under test never touches Cambridge/Pons over the network.
vi.mock("@/lib/services/dictionary", () => ({ lookupWord: vi.fn() }));
vi.mock("@/lib/services/dictionary-de", () => ({ lookupWordDe: vi.fn() }));

import { POST } from "./generate";
import { generateFlashcardProposals } from "@/lib/services/ai";
import { checkRateLimit } from "@/lib/services/ai-rate-limit";
import { getUserPrompt } from "@/lib/services/user-settings";
import { checkDuplicateFronts } from "@/lib/services/flashcards";
import { lookupWord } from "@/lib/services/dictionary";
import { lookupWordDe } from "@/lib/services/dictionary-de";

const generateMock = vi.mocked(generateFlashcardProposals);
const checkRateLimitMock = vi.mocked(checkRateLimit);
const getUserPromptMock = vi.mocked(getUserPrompt);
const checkDuplicateFrontsMock = vi.mocked(checkDuplicateFronts);
const lookupWordMock = vi.mocked(lookupWord);
const lookupWordDeMock = vi.mocked(lookupWordDe);

type PostContext = Parameters<typeof POST>[0];

const SET_ID = "s1";
const VALID_TEXT = "This is a long enough source text for flashcard generation.";

function makeSupabase(setRow: { id: string } | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: setRow, error: null }),
  };
  return { from: () => chain };
}

function makeContext(opts: { body?: unknown; setRow?: { id: string } | null; setId?: string } = {}): PostContext {
  const setRow = "setRow" in opts ? (opts.setRow ?? null) : { id: SET_ID };
  const body = "body" in opts ? opts.body : { text: VALID_TEXT };
  const setId = "setId" in opts ? opts.setId : SET_ID;
  const request = new Request(`http://localhost/api/sets/${setId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    locals: { user: { id: "user-1" }, supabase: makeSupabase(setRow) },
    params: { id: setId },
    request,
  } as unknown as PostContext;
}

describe("POST /api/sets/[id]/generate — failure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "test-key";
    checkRateLimitMock.mockResolvedValue({ allowed: true, limit: 10, remaining: 9 });
    getUserPromptMock.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  // Real error→status mapping (getAiErrorHttpStatus) is exercised via the partial mock.
  const cases: { kind: AiServiceError["kind"]; status: number }[] = [
    { kind: "apiError", status: 502 },
    { kind: "timeout", status: 504 },
    { kind: "parseError", status: 422 },
    { kind: "noProposals", status: 422 },
  ];

  it.each(cases)("maps AI error kind '$kind' to HTTP $status with no flashcards", async ({ kind, status }) => {
    const message = `simulated ${kind}`;
    generateMock.mockResolvedValue({ data: [], error: { kind, message } });

    const res = await POST(makeContext());
    const body: Record<string, unknown> = await res.json();

    expect(res.status).toBe(status);
    expect(body.kind).toBe(kind);
    expect(body.error).toBe(message);
    // Zero-save guarantee: no flashcards emitted, dedup never reached.
    expect(body).not.toHaveProperty("flashcards");
    expect(checkDuplicateFrontsMock).not.toHaveBeenCalled();
  });

  it("returns 500 when OPENROUTER_API_KEY is not configured, without calling the provider", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const res = await POST(makeContext());
    const body: Record<string, unknown> = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("AI generation is not configured");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input (text too short) without calling the provider", async () => {
    const res = await POST(makeContext({ body: { text: "short" } }));
    const body: Record<string, unknown> = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Validation failed");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate-limited, without calling the provider", async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, limit: 10, remaining: 0 });

    const res = await POST(makeContext());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(generateMock).not.toHaveBeenCalled();
  });
});

// `handleToolCall` is module-internal, so we exercise it (and the tool wiring)
// through the `tools` / `onToolCall` arguments the route hands to
// `generateFlashcardProposals`. The provider itself is the partial-mock from
// the top of the file; we drive the success path so those arguments exist.
describe("POST /api/sets/[id]/generate — dictionary tool wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "test-key";
    checkRateLimitMock.mockResolvedValue({ allowed: true, limit: 10, remaining: 9 });
    getUserPromptMock.mockResolvedValue({ data: null, error: null });
    generateMock.mockResolvedValue({ data: [], error: null });
    checkDuplicateFrontsMock.mockResolvedValue({ normalizedFronts: new Set(), error: null });
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  // Drives the success path once, then returns the provider arguments with a
  // guaranteed-defined `onToolCall` (guarded rather than `!`-asserted so the
  // no-non-null-assertion lint rule stays satisfied).
  async function callProvider() {
    const res = await POST(makeContext());
    expect(res.status).toBe(200);
    expect(generateMock).toHaveBeenCalledTimes(1);
    const args = generateMock.mock.calls[0][0];
    const onToolCall = args.onToolCall;
    if (!onToolCall) throw new Error("route did not pass onToolCall to the provider");
    return { tools: args.tools ?? [], onToolCall };
  }

  it("passes both lookup_word and lookup_word_de tools to the provider", async () => {
    const { tools } = await callProvider();
    const toolNames = tools.map((t) => t.function.name);
    expect(toolNames).toEqual(["lookup_word", "lookup_word_de"]);
  });

  it("dispatches lookup_word_de to lookupWordDe and returns the JSON-stringified entries", async () => {
    const entries = [{ definition: "Dom.", type: "rzeczownik", dictionaryRegion: null, info: null, examples: [] }];
    lookupWordDeMock.mockResolvedValue(entries);

    const { onToolCall } = await callProvider();
    const result = await onToolCall("lookup_word_de", { word: "Haus" });

    expect(lookupWordDeMock).toHaveBeenCalledTimes(1);
    expect(lookupWordDeMock.mock.calls[0][0]).toBe("Haus");
    // The KV cache is threaded through so AI lookups share the endpoint's cache
    // (null under the node test env, where `env.AI_RATE_LIMIT` is absent).
    expect(lookupWordDeMock.mock.calls[0][1]).toHaveProperty("kv");
    expect(lookupWordMock).not.toHaveBeenCalled();
    expect(result).toBe(JSON.stringify(entries));
  });

  it("dispatches lookup_word to lookupWord (EN branch unaffected)", async () => {
    const entries = [{ definition: "House.", type: "noun", dictionaryRegion: "UK", info: null, examples: [] }];
    lookupWordMock.mockResolvedValue(entries as never);

    const { onToolCall } = await callProvider();
    const result = await onToolCall("lookup_word", { word: "house" });

    expect(lookupWordMock).toHaveBeenCalledWith("house");
    expect(lookupWordDeMock).not.toHaveBeenCalled();
    expect(result).toBe(JSON.stringify(entries));
  });

  it("returns an Unknown tool error for an unrecognized tool name", async () => {
    const { onToolCall } = await callProvider();
    const result = await onToolCall("something_else", {});
    expect(result).toBe(JSON.stringify({ error: "Unknown tool" }));
  });

  it("returns a lookup-failed error when lookupWordDe throws", async () => {
    lookupWordDeMock.mockRejectedValue(new Error("Pons down"));

    const { onToolCall } = await callProvider();
    const result = await onToolCall("lookup_word_de", { word: "Haus" });
    expect(result).toBe(JSON.stringify({ error: "Dictionary lookup failed" }));
  });
});
