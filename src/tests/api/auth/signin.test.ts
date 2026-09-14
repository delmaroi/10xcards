import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext, locationOf } from "@/test/factories";

// Endpoint wiring for the password sign-in form. The new API reads formData()
// and returns error CODES (not human-readable strings) via redirect query params.

const signInWithPassword = vi.fn();
const createClient = vi.fn<() => unknown>(() => ({ auth: { signInWithPassword } }));

vi.mock("@/lib/supabase", () => ({ createClient: () => createClient() }));

const { POST } = await import("@/pages/api/auth/signin");

function formContext(body: string) {
  return makeApiContext({
    url: "/api/auth/signin",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

const errorFrom = (response: Response) =>
  new URL(locationOf(response) ?? "", "http://localhost").searchParams.get("error");

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { signInWithPassword } });
  signInWithPassword.mockResolvedValue({ error: null });
});

describe("POST /api/auth/signin", () => {
  it("signs in and lands on the root route", async () => {
    const response = await POST(formContext("email=a%40b.com&password=secret"));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "secret" });
    expect(response.status).toBe(302);
    expect(locationOf(response)).toBe("/");
  });

  it("bounces back with INVALID_CREDENTIALS on bad credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const response = await POST(formContext("email=a%40b.com&password=wrong"));
    expect(locationOf(response)).toMatch(/^\/auth\/signin\?error=/);
    expect(errorFrom(response)).toBe("INVALID_CREDENTIALS");
  });

  it("returns SERVER_ERROR for a non-invalid provider error", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Rate limit exceeded" } });
    const response = await POST(formContext("email=a%40b.com&password=x"));
    expect(errorFrom(response)).toBe("SERVER_ERROR");
  });

  it("reports unconfigured Supabase with SUPABASE_NOT_CONFIGURED code", async () => {
    createClient.mockReturnValue(null);
    const response = await POST(formContext("email=a%40b.com&password=secret"));
    expect(errorFrom(response)).toBe("SUPABASE_NOT_CONFIGURED");
  });
});
