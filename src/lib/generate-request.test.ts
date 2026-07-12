import { describe, it, expect, vi } from "vitest";
import { handleGenerateRequest } from "@/lib/generate-request";

// Oracle = the endpoint contract (auth/validation/status mapping), not the impl.
function okFetch(proposals: unknown) {
  const body = JSON.stringify({ choices: [{ message: { content: JSON.stringify(proposals) } }] });
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200 }));
}

const KEY = "sk-or-test";
const TEXT = "a".repeat(50);

describe("handleGenerateRequest (S-01 endpoint contract)", () => {
  it("returns 401 when there is no user (API caller, not a redirect)", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const r = await handleGenerateRequest({ userId: null, body: { text: TEXT }, apiKey: KEY, fetchImpl });
    expect(r.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is malformed", async () => {
    const r = await handleGenerateRequest({ userId: "u1", body: { notText: 1 }, apiKey: KEY });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "invalid_request" });
  });

  it("returns 400 for too-short text (invalid_input from the client)", async () => {
    const r = await handleGenerateRequest({ userId: "u1", body: { text: "  " }, apiKey: KEY });
    expect(r.status).toBe(400);
  });

  it("returns 200 with proposals on success", async () => {
    const fetchImpl = okFetch([{ front: "Q", back: "A" }]);
    const r = await handleGenerateRequest({ userId: "u1", body: { text: TEXT }, apiKey: KEY, fetchImpl });
    expect(r).toEqual({ status: 200, body: { proposals: [{ front: "Q", back: "A" }] } });
  });

  it("returns 502 when the provider output is unusable", async () => {
    const bad = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "nope" } }] }), { status: 200 }),
      );
    const r = await handleGenerateRequest({ userId: "u1", body: { text: TEXT }, apiKey: KEY, fetchImpl: bad });
    expect(r.status).toBe(502);
  });
});
