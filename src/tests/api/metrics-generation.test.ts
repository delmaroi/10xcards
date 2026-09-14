import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext } from "@/test/factories";

// POST /api/metrics/generation — thin route that delegates to handleRecordStats.
// The route wires: body parsing, user from locals, supabase-backed insertStat callback.

const handleRecordStats = vi.fn();

vi.mock("@/lib/record-generation-stats", () => ({
  handleRecordStats: (...args: unknown[]): unknown => handleRecordStats(...args),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: vi.fn() }),
}));

const { POST } = await import("@/pages/api/metrics/generation");

const USER = { id: "user-1" };

function context(body: string | null, user: { id: string } | null = USER) {
  return makeApiContext({
    url: "/api/metrics/generation",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    user,
  });
}

const valid = JSON.stringify({ generated: 10, accepted: 4, edited: 2 });

beforeEach(() => {
  vi.clearAllMocks();
  handleRecordStats.mockResolvedValue({ status: 201, body: { recorded: true } });
});

describe("POST /api/metrics/generation", () => {
  it("returns the handler result serialized as JSON", async () => {
    const response = await POST(context(valid));
    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ recorded: true });
  });

  it("passes user id to the handler", async () => {
    await POST(context(valid));
    expect(handleRecordStats).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
  });

  it("passes null body when JSON parsing fails", async () => {
    handleRecordStats.mockResolvedValue({ status: 400, body: { error: "invalid_request" } });
    await POST(context("{oops"));
    expect(handleRecordStats).toHaveBeenCalledWith(expect.objectContaining({ body: null }));
  });

  it("passes null userId for an anonymous caller", async () => {
    handleRecordStats.mockResolvedValue({ status: 401, body: { error: "unauthorized" } });
    const response = await POST(context(valid, null));
    expect(response.status).toBe(401);
    expect(handleRecordStats).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("forwards handler status codes faithfully", async () => {
    handleRecordStats.mockResolvedValue({ status: 500, body: { error: "record_failed" } });
    const response = await POST(context(valid));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "record_failed" });
  });

  it("provides an insertStat callback", async () => {
    await POST(context(valid));
    const callArgs = handleRecordStats.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs).toHaveProperty("insertStat");
    expect(typeof callArgs.insertStat).toBe("function");
  });
});
