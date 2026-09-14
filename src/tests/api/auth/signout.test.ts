import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext, locationOf } from "@/test/factories";

const signOut = vi.fn();
const createClient = vi.fn<() => unknown>(() => ({ auth: { signOut } }));

vi.mock("@/lib/supabase", () => ({ createClient: () => createClient() }));

const { POST } = await import("@/pages/api/auth/signout");

const context = () => makeApiContext({ url: "/api/auth/signout", method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { signOut } });
  signOut.mockResolvedValue({ error: null });
});

describe("POST /api/auth/signout", () => {
  it("clears the session and returns to the landing page", async () => {
    const response = await POST(context());
    expect(signOut).toHaveBeenCalledOnce();
    expect(locationOf(response)).toBe("/");
  });

  it("still lands on the landing page when Supabase is unconfigured", async () => {
    createClient.mockReturnValue(null);
    const response = await POST(context());
    expect(locationOf(response)).toBe("/");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("redirects even if the provider reports a sign-out error", async () => {
    // The cookie is cleared by the SSR client regardless; stranding the user on an
    // error page would leave them looking signed in.
    signOut.mockResolvedValue({ error: { message: "network" } });
    expect(locationOf(await POST(context()))).toBe("/");
  });
});
