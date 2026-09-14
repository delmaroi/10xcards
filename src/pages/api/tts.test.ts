import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_VOICE } from "@/lib/tts/voices";

// The node stub gives `env = {}`, so the route calls `checkTtsRateLimit(null, …)`,
// which fails CLOSED and would 429 every request. Mock the gate → allowed.
vi.mock("@/lib/services/ai-rate-limit", () => ({ checkTtsRateLimit: vi.fn() }));

// Partial mock: override ONLY `synthesizeSpeech` (the provider boundary) so the
// real error→status helpers stay in play.
vi.mock("@/lib/services/tts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/tts")>();
  return { ...actual, synthesizeSpeech: vi.fn() };
});

import { POST } from "./tts";
import { checkTtsRateLimit } from "@/lib/services/ai-rate-limit";
import { synthesizeSpeech } from "@/lib/services/tts";

const checkTtsRateLimitMock = vi.mocked(checkTtsRateLimit);
const synthesizeMock = vi.mocked(synthesizeSpeech);

type PostContext = Parameters<typeof POST>[0];

function makeContext(opts: { body?: unknown; authed?: boolean } = {}): PostContext {
  const authed = opts.authed ?? true;
  const request = new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify("body" in opts ? opts.body : { text: "hallo", voice: DEFAULT_VOICE }),
  });
  return {
    locals: authed ? { user: { id: "user-1" }, supabase: {} } : { user: null, supabase: null },
    request,
  } as unknown as PostContext;
}

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_TTS_API_KEY = "test-key";
    checkTtsRateLimitMock.mockResolvedValue({ allowed: true, limit: 60, remaining: 59 });
  });

  afterEach(() => {
    delete process.env.GOOGLE_TTS_API_KEY;
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeContext({ authed: false }));
    expect(res.status).toBe(401);
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for text longer than 1000 chars without calling the provider", async () => {
    const res = await POST(makeContext({ body: { text: "a".repeat(1001), voice: DEFAULT_VOICE } }));
    expect(res.status).toBe(400);
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid voice without calling the provider", async () => {
    const res = await POST(makeContext({ body: { text: "hi", voice: "not-a-voice" } }));
    expect(res.status).toBe(400);
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the API key is not configured", async () => {
    delete process.env.GOOGLE_TTS_API_KEY;
    const res = await POST(makeContext());
    expect(res.status).toBe(500);
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("returns 200 audio/mpeg on the happy path", async () => {
    synthesizeMock.mockResolvedValue({ data: new Uint8Array([1, 2, 3]), error: null });

    const res = await POST(makeContext());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([1, 2, 3]);
    expect(synthesizeMock).toHaveBeenCalledOnce();
  });

  it("maps a provider error to its HTTP status", async () => {
    synthesizeMock.mockResolvedValue({ data: null, error: { kind: "apiError", message: "boom" } });

    const res = await POST(makeContext());
    expect(res.status).toBe(502);
  });
});
