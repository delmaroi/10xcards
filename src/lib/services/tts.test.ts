import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { synthesizeSpeech } from "./tts";

const VALID_INPUT = { text: "hello world", gcpVoice: "en-US-Neural2-C", languageCode: "en-US", apiKey: "k" };

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unconfigured without calling fetch when the API key is empty", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { data, error } = await synthesizeSpeech({ ...VALID_INPUT, apiKey: "" });
    expect(data).toBeNull();
    expect(error?.kind).toBe("unconfigured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("decodes base64 audioContent to bytes on the happy path", async () => {
    const audioContent = btoa("MP3-BYTES");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ audioContent }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const { data, error } = await synthesizeSpeech(VALID_INPUT);
    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(decode(data ?? new Uint8Array())).toBe("MP3-BYTES");
  });

  it("returns apiError on a non-ok provider response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("upstream boom", { status: 500 }));

    const { data, error } = await synthesizeSpeech(VALID_INPUT);
    expect(data).toBeNull();
    expect(error?.kind).toBe("apiError");
    expect(error?.message).toContain("500");
  });

  it("returns apiError when the response shape is unexpected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ notAudio: true }), { status: 200 }));

    const { data, error } = await synthesizeSpeech(VALID_INPUT);
    expect(data).toBeNull();
    expect(error?.kind).toBe("apiError");
  });

  it("returns timeout when the request aborts", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const { data, error } = await synthesizeSpeech(VALID_INPUT);
    expect(data).toBeNull();
    expect(error?.kind).toBe("timeout");
  });
});
