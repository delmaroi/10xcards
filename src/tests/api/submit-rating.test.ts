import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext } from "@/test/factories";

// POST /api/review/submit-rating — thin route that delegates to handleSubmitRating.
// The route wires: body parsing, user from locals, supabase-backed load/save callbacks.

const handleSubmitRating = vi.fn();

vi.mock("@/lib/review-rating", () => ({
  handleSubmitRating: (...args: unknown[]): unknown => handleSubmitRating(...args),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: vi.fn() }),
}));

const { POST } = await import("@/pages/api/review/submit-rating");

const USER = { id: "user-1" };

function context(body: string | null, user: { id: string } | null = USER) {
  return makeApiContext({
    url: "/api/review/submit-rating",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    user,
  });
}

const good = JSON.stringify({ id: "card-1", rating: 3 });

beforeEach(() => {
  vi.clearAllMocks();
  handleSubmitRating.mockResolvedValue({
    status: 200,
    body: { due: "2026-09-15T00:00:00Z", reps: 1 },
  });
});

describe("POST /api/review/submit-rating", () => {
  it("returns the handler result serialized as JSON", async () => {
    const response = await POST(context(good));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ due: "2026-09-15T00:00:00Z", reps: 1 });
  });

  it("passes user id to the handler", async () => {
    await POST(context(good));
    expect(handleSubmitRating).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
  });

  it("passes null body when JSON parsing fails", async () => {
    handleSubmitRating.mockResolvedValue({ status: 400, body: { error: "invalid_request" } });
    await POST(context("{oops"));
    expect(handleSubmitRating).toHaveBeenCalledWith(expect.objectContaining({ body: null }));
  });

  it("passes null userId for an anonymous caller", async () => {
    handleSubmitRating.mockResolvedValue({ status: 401, body: { error: "unauthorized" } });
    const response = await POST(context(good, null));
    expect(response.status).toBe(401);
    expect(handleSubmitRating).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("forwards handler status codes faithfully", async () => {
    handleSubmitRating.mockResolvedValue({ status: 404, body: { error: "not_found" } });
    const response = await POST(context(good));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("provides loadCard and saveState callbacks", async () => {
    await POST(context(good));
    const callArgs = handleSubmitRating.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs).toHaveProperty("loadCard");
    expect(callArgs).toHaveProperty("saveState");
    expect(typeof callArgs.loadCard).toBe("function");
    expect(typeof callArgs.saveState).toBe("function");
  });
});
