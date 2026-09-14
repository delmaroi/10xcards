import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext, locationOf } from "@/test/factories";

const exchangeCodeForSession = vi.fn();
const createClient = vi.fn<() => unknown>(() => ({ auth: { exchangeCodeForSession } }));

vi.mock("@/lib/supabase", () => ({ createClient: () => createClient() }));

const { GET } = await import("@/pages/api/auth/callback");

const errorFrom = (response: Response) =>
  new URL(locationOf(response) ?? "", "http://localhost").searchParams.get("error");

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { exchangeCodeForSession } });
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("GET /api/auth/callback (OAuth return leg)", () => {
  it("exchanges the code and lands on the dashboard", async () => {
    const response = await GET(makeApiContext({ url: "/api/auth/callback?code=abc123" }));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(locationOf(response)).toBe("/dashboard");
  });

  it("rejects a callback with no code", async () => {
    const response = await GET(makeApiContext({ url: "/api/auth/callback" }));
    expect(errorFrom(response)).toBe("Missing OAuth code");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("surfaces an exchange failure on the sign-in page", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid grant" } });
    const response = await GET(makeApiContext({ url: "/api/auth/callback?code=stale" }));
    expect(errorFrom(response)).toBe("invalid grant");
  });

  it("never lands on the dashboard when the exchange failed", async () => {
    // Otherwise the user reaches a logged-in-looking page with no session and is
    // bounced straight back out by the middleware.
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid grant" } });
    const response = await GET(makeApiContext({ url: "/api/auth/callback?code=stale" }));
    expect(locationOf(response)).not.toBe("/dashboard");
  });

  it("reports unconfigured Supabase instead of crashing", async () => {
    createClient.mockReturnValue(null);
    const response = await GET(makeApiContext({ url: "/api/auth/callback?code=abc" }));
    expect(errorFrom(response)).toBe("Supabase is not configured");
  });
});
