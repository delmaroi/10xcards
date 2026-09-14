import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_VOICE, SUPPORTED_VOICES } from "@/lib/tts/voices";

// Mock the service boundary; the real zod schema + isValidVoice run in the route.
vi.mock("@/lib/services/user-settings", () => ({
  getUserVoices: vi.fn(),
  upsertUserVoices: vi.fn(),
}));

import { GET, PUT } from "./user-voice";
import { getUserVoices, upsertUserVoices } from "@/lib/services/user-settings";

const getUserVoicesMock = vi.mocked(getUserVoices);
const upsertUserVoicesMock = vi.mocked(upsertUserVoices);

type PutContext = Parameters<typeof PUT>[0];

// A second valid voice id distinct from DEFAULT_VOICE, for the happy-path pair.
const OTHER_VOICE = SUPPORTED_VOICES.find((v) => v.id !== DEFAULT_VOICE)?.id ?? DEFAULT_VOICE;

function makeContext(opts: { body?: unknown; authed?: boolean } = {}): PutContext {
  const authed = opts.authed ?? true;
  const request = new Request("http://localhost/api/user-voice", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify("body" in opts ? opts.body : { front: DEFAULT_VOICE, back: OTHER_VOICE }),
  });
  return {
    locals: authed ? { user: { id: "user-1" }, supabase: {} } : { user: null, supabase: null },
    request,
  } as unknown as PutContext;
}

describe("PUT /api/user-voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await PUT(makeContext({ authed: false }));
    expect(res.status).toBe(401);
    expect(upsertUserVoicesMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid voice id with 400 without calling the service", async () => {
    const res = await PUT(makeContext({ body: { front: "not-a-voice", back: DEFAULT_VOICE } }));
    expect(res.status).toBe(400);
    expect(upsertUserVoicesMock).not.toHaveBeenCalled();
  });

  it("accepts a valid pair with 200 and returns the saved voices", async () => {
    upsertUserVoicesMock.mockResolvedValue({ data: { front: DEFAULT_VOICE, back: OTHER_VOICE }, error: null });

    const res = await PUT(makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ front: DEFAULT_VOICE, back: OTHER_VOICE });
    expect(upsertUserVoicesMock).toHaveBeenCalledWith(expect.anything(), "user-1", {
      front: DEFAULT_VOICE,
      back: OTHER_VOICE,
    });
  });

  it("returns 500 when the service errors", async () => {
    upsertUserVoicesMock.mockResolvedValue({
      data: { front: DEFAULT_VOICE, back: OTHER_VOICE },
      error: { message: "db down" } as never,
    });

    const res = await PUT(makeContext());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/user-voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the account's voices with 200", async () => {
    getUserVoicesMock.mockResolvedValue({ data: { front: DEFAULT_VOICE, back: OTHER_VOICE }, error: null });

    const res = await GET({
      locals: { user: { id: "user-1" }, supabase: {} },
      request: new Request("http://localhost/api/user-voice"),
    } as unknown as Parameters<typeof GET>[0]);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ front: DEFAULT_VOICE, back: OTHER_VOICE });
  });
});
