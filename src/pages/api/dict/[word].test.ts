import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/dictionary", () => ({ lookupWord: vi.fn() }));
vi.mock("@/lib/services/ai-rate-limit", () => ({ checkDictRateLimit: vi.fn() }));

import { GET } from "./[word]";
import { lookupWord } from "@/lib/services/dictionary";
import { checkDictRateLimit } from "@/lib/services/ai-rate-limit";
import type { DictionaryEntry } from "@/types";

const lookupWordMock = vi.mocked(lookupWord);
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

const SAMPLE_ENTRY: DictionaryEntry = {
  definition: "A small domesticated carnivorous mammal.",
  type: "noun",
  dictionaryRegion: "UK",
  info: "B1",
  examples: ["The cat sat on the mat."],
};

describe("GET /api/dict/[word]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkDictRateLimitMock.mockResolvedValue({ allowed: true, limit: 30, remaining: 29 });
  });

  it("returns 401 when there is no authenticated user", async () => {
    const res = await GET(makeContext({ word: "cat", user: null }));
    expect(res.status).toBe(401);
    expect(lookupWordMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the word param is empty after trimming", async () => {
    const res = await GET(makeContext({ word: "   " }));
    expect(res.status).toBe(400);
    expect(lookupWordMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    checkDictRateLimitMock.mockResolvedValue({ allowed: false, limit: 30, remaining: 0 });
    const res = await GET(makeContext({ word: "cat" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(lookupWordMock).not.toHaveBeenCalled();
  });

  it("returns 200 with entries for a valid word", async () => {
    lookupWordMock.mockResolvedValue([SAMPLE_ENTRY]);
    const res = await GET(makeContext({ word: "cat" }));
    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ word: "cat", entries: [SAMPLE_ENTRY] });
    expect(lookupWordMock).toHaveBeenCalledWith("cat");
  });

  it("returns 200 with empty entries for an unknown word", async () => {
    lookupWordMock.mockResolvedValue([]);
    const res = await GET(makeContext({ word: "xyznotaword" }));
    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ word: "xyznotaword", entries: [] });
  });

  it("returns 502 when the dictionary lookup throws", async () => {
    lookupWordMock.mockRejectedValue(new Error("network down"));
    const res = await GET(makeContext({ word: "cat" }));
    expect(res.status).toBe(502);
    expect(await jsonBody(res)).toEqual({ error: "Dictionary service unavailable" });
  });
});
