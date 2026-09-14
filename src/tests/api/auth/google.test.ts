import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext, locationOf } from "@/test/factories";

// FR-001 SSO init. The load-bearing details: the PKCE flow must run through the SSR
// client (so the verifier cookie is set) and the callback URL must be absolute and
// built from the REQUEST origin — a hardcoded one breaks preview deployments.

const signInWithOAuth = vi.fn();
const createClient = vi.fn<() => unknown>(() => ({ auth: { signInWithOAuth } }));

vi.mock("@/lib/supabase", () => ({ createClient: () => createClient() }));

const { GET } = await import("@/pages/api/auth/google");

const context = (url = "/api/auth/google") => makeApiContext({ url });
const errorFrom = (response: Response) =>
  new URL(locationOf(response) ?? "", "http://localhost").searchParams.get("error");

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { signInWithOAuth } });
  signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/auth?x=1" }, error: null });
});

describe("GET /api/auth/google", () => {
  it("redirects the browser to the provider's consent screen", async () => {
    const response = await GET(context());
    expect(response.status).toBe(302);
    expect(locationOf(response)).toBe("https://accounts.google.com/o/oauth2/auth?x=1");
  });

  it("asks for Google and points the callback at this origin", async () => {
    await GET(context());
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:4321/api/auth/callback" },
    });
  });

  it("falls back to the sign-in page when the provider errors", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "provider down" } });
    const response = await GET(context());
    expect(locationOf(response)).toMatch(/^\/auth\/signin\?error=/);
    expect(errorFrom(response)).toBe("provider down");
  });

  it("uses a generic message when the provider returns no URL and no error", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
    expect(errorFrom(await GET(context()))).toBe("Could not start Google sign-in");
  });

  it("reports unconfigured Supabase instead of crashing", async () => {
    createClient.mockReturnValue(null);
    expect(errorFrom(await GET(context()))).toBe("Supabase is not configured");
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
});
