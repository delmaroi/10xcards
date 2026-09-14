import { describe, it, expect, vi } from "vitest";
import { generateFlashcards } from "@/lib/openrouter";

// Oracle = the JSON contract (array of {front, back}), NOT the implementation.
// fetch is injected so no network is hit.

function stubFetch(content: string, ok = true) {
  const body = JSON.stringify({ choices: [{ message: { content } }] });
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: ok ? 200 : 500 }));
}

const KEY = "sk-or-test";
const TEXT = "a".repeat(50);

describe("generateFlashcards (S-01 OpenRouter client)", () => {
  it("returns validated proposals from a well-formed response", async () => {
    const fetchImpl = stubFetch(JSON.stringify([{ front: "Q1", back: "A1" }]));
    const r = await generateFlashcards(TEXT, KEY, fetchImpl);
    expect(r).toEqual({ ok: true, proposals: [{ front: "Q1", back: "A1" }] });
  });

  it("strips markdown fences before parsing", async () => {
    const fetchImpl = stubFetch('```json\n[{"front":"Q","back":"A"}]\n```');
    const r = await generateFlashcards(TEXT, KEY, fetchImpl);
    expect(r.ok).toBe(true);
  });

  it("rejects too-short input without calling the API", async () => {
    const fetchImpl = vi.fn();
    const r = await generateFlashcards("   ", KEY, fetchImpl);
    expect(r).toEqual({ ok: false, error: "invalid_input" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects oversized input without calling the API", async () => {
    const fetchImpl = vi.fn();
    const r = await generateFlashcards("a".repeat(10_001), KEY, fetchImpl);
    expect(r).toEqual({ ok: false, error: "invalid_input" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns bad_output on non-JSON content", async () => {
    const fetchImpl = stubFetch("sorry, I cannot do that");
    const r = await generateFlashcards(TEXT, KEY, fetchImpl);
    expect(r).toEqual({ ok: false, error: "bad_output" });
  });

  it("returns bad_output when the JSON shape is wrong", async () => {
    const fetchImpl = stubFetch(JSON.stringify([{ q: "x" }]));
    const r = await generateFlashcards(TEXT, KEY, fetchImpl);
    expect(r).toEqual({ ok: false, error: "bad_output" });
  });

  it("returns provider_error on non-ok HTTP", async () => {
    const fetchImpl = stubFetch("", false);
    const r = await generateFlashcards(TEXT, KEY, fetchImpl);
    expect(r).toEqual({ ok: false, error: "provider_error" });
  });

  it("returns provider_error when fetch throws", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("network"));
    const r = await generateFlashcards(TEXT, KEY, fetchImpl);
    expect(r).toEqual({ ok: false, error: "provider_error" });
  });

  it("returns provider_error when the response body is not JSON at all", async () => {
    // A gateway HTML error page still arrives with status 200 sometimes; res.json()
    // throws and must be caught rather than crashing the endpoint.
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("<html>502</html>", { status: 200 }));
    await expect(generateFlashcards(TEXT, KEY, fetchImpl)).resolves.toEqual({ ok: false, error: "provider_error" });
  });

  it("fails fast when no API key is configured, without calling the provider", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(generateFlashcards(TEXT, "", fetchImpl)).resolves.toEqual({ ok: false, error: "provider_error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns bad_output when the response JSON carries no choices", async () => {
    // Well-formed JSON, wrong shape — content falls back to "" and fails validation.
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(generateFlashcards(TEXT, KEY, fetchImpl)).resolves.toEqual({ ok: false, error: "bad_output" });
  });
});
