import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/dictionary-de", () => ({ lookupWordDe: vi.fn() }));
vi.mock("@/lib/services/ai-rate-limit", () => ({ checkDictRateLimit: vi.fn() }));

import { GET } from "./[word]";
import { lookupWordDe } from "@/lib/services/dictionary-de";
import { checkDictRateLimit } from "@/lib/services/ai-rate-limit";
import type { DictionaryEntry } from "@/types";

const lookupWordDeMock = vi.mocked(lookupWordDe);
const checkDictRateLimitMock = vi.mocked(checkDictRateLimit);

type GetContext = Parameters<typeof GET>[0];

async function jsonBody(res: Response): Promise<unknown> {
  return res.json();
}

function makeContext(opts: { word?: string; user?: { id: string } | null; supabase?: unknown }): GetContext {
  const user = "user" in opts ? opts.user : { id: "user-1" };
  const supabase = "supabase" in opts ? opts.supabase : {};
  return {
    params: { word: opts.word },
    locals: { user, supabase },
  } as unknown as GetContext;
}

const SAMPLE_ENTRY_DE: DictionaryEntry = {
  definition: "Budynek mieszkalny.",
  type: "rzeczownik",
  dictionaryRegion: null,
  info: "budownictwo",
  examples: [],
};

describe("GET /api/dict/de/[word]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkDictRateLimitMock.mockResolvedValue({ allowed: true, limit: 30, remaining: 29 });
  });

  it("returns 401 when there is no authenticated user", async () => {
    const res = await GET(makeContext({ word: "Haus", user: null }));
    expect(res.status).toBe(401);
    expect(lookupWordDeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the word param is empty after trimming", async () => {
    const res = await GET(makeContext({ word: "   " }));
    expect(res.status).toBe(400);
    expect(lookupWordDeMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    checkDictRateLimitMock.mockResolvedValue({ allowed: false, limit: 30, remaining: 0 });
    const res = await GET(makeContext({ word: "Haus" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(lookupWordDeMock).not.toHaveBeenCalled();
  });

  it("returns 200 with entries for a valid word and passes kv through", async () => {
    lookupWordDeMock.mockResolvedValue([SAMPLE_ENTRY_DE]);
    const res = await GET(makeContext({ word: "Haus" }));
    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ word: "Haus", entries: [SAMPLE_ENTRY_DE] });
    // The endpoint forwards the KV namespace, normalized to null when the
    // binding is absent (as under the Node test stub), so the service can
    // read/write its 30-day cache.
    expect(lookupWordDeMock).toHaveBeenCalledWith("Haus", { kv: null });
  });

  it("returns 200 with empty entries for a Pons 204 (unknown word)", async () => {
    lookupWordDeMock.mockResolvedValue([]);
    const res = await GET(makeContext({ word: "xyznotaword" }));
    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ word: "xyznotaword", entries: [] });
  });

  it("returns 502 when the dictionary lookup throws (secret missing / Pons 5xx / timeout)", async () => {
    lookupWordDeMock.mockRejectedValue(new Error("Pons request failed with status 503"));
    const res = await GET(makeContext({ word: "Haus" }));
    expect(res.status).toBe(502);
    expect(await jsonBody(res)).toEqual({ error: "Dictionary service unavailable" });
  });
});
