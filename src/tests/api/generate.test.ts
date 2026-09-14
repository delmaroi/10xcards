import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext } from "@/test/factories";

// POST /api/generate — thin route that delegates to handleGenerateRequest.
// We mock the handler to test the route wiring: body parsing, user extraction,
// and response serialization.

const handleGenerateRequest = vi.fn();

vi.mock("@/lib/generate-request", () => ({
  handleGenerateRequest: (...args: unknown[]): unknown => handleGenerateRequest(...args),
}));

// The route reads OPENROUTER_API_KEY from astro:env/server; already stubbed in test setup.

const { POST } = await import("@/pages/api/generate");

const USER = { id: "user-1" };

function context(body: string | null, user: { id: string } | null = USER) {
  return makeApiContext({
    url: "/api/generate",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    user,
  });
}

const validBody = JSON.stringify({ text: "a".repeat(200) });

beforeEach(() => {
  vi.clearAllMocks();
  handleGenerateRequest.mockResolvedValue({
    status: 200,
    body: { proposals: [{ front: "q", back: "a" }] },
  });
});

describe("POST /api/generate", () => {
  it("returns the handler result serialized as JSON", async () => {
    const response = await POST(context(validBody));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ proposals: [{ front: "q", back: "a" }] });
  });

  it("passes user id and parsed body to the handler", async () => {
    await POST(context(validBody));
    expect(handleGenerateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        body: { text: "a".repeat(200) },
        apiKey: expect.any(String) as string,
      }),
    );
  });

  it("passes null userId for an anonymous caller", async () => {
    handleGenerateRequest.mockResolvedValue({ status: 401, body: { error: "unauthorized" } });
    const response = await POST(context(validBody, null));
    expect(response.status).toBe(401);
    expect(handleGenerateRequest).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("passes undefined body when JSON parsing fails", async () => {
    handleGenerateRequest.mockResolvedValue({ status: 400, body: { error: "invalid_request" } });
    await POST(context("{not json"));
    expect(handleGenerateRequest).toHaveBeenCalledWith(expect.objectContaining({ body: undefined }));
  });

  it("forwards handler status codes faithfully (e.g. 502)", async () => {
    handleGenerateRequest.mockResolvedValue({ status: 502, body: { error: "provider_error" } });
    const response = await POST(context(validBody));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "provider_error" });
  });
});
