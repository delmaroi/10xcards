import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext, locationOf } from "@/test/factories";

const signUp = vi.fn();
const createClient = vi.fn<() => unknown>(() => ({ auth: { signUp } }));

vi.mock("@/lib/supabase", () => ({ createClient: () => createClient() }));

const { POST } = await import("@/pages/api/auth/signup");

function formContext(body: string) {
  return makeApiContext({
    url: "/api/auth/signup",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

const errorFrom = (response: Response) =>
  new URL(locationOf(response) ?? "", "http://localhost").searchParams.get("error");

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { signUp } });
  signUp.mockResolvedValue({ error: null });
});

describe("POST /api/auth/signup", () => {
  it("registers and sends the user to the confirm-email page", async () => {
    const response = await POST(formContext("email=new%40b.com&password=secret"));
    expect(signUp).toHaveBeenCalledWith({ email: "new@b.com", password: "secret" });
    expect(locationOf(response)).toBe("/auth/confirm-email");
  });

  it("returns EMAIL_ALREADY_REGISTERED when the user already exists", async () => {
    signUp.mockResolvedValue({ error: { message: "User already registered" } });
    const response = await POST(formContext("email=new%40b.com&password=secret"));
    expect(locationOf(response)).toMatch(/^\/auth\/signup\?error=/);
    expect(errorFrom(response)).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("returns SERVER_ERROR for a non-already-registered provider error", async () => {
    signUp.mockResolvedValue({ error: { message: "Password too short" } });
    const response = await POST(formContext("email=new%40b.com&password=x"));
    expect(errorFrom(response)).toBe("SERVER_ERROR");
  });

  it("never redirects to confirm-email when signup failed", async () => {
    signUp.mockResolvedValue({ error: { message: "Password too short" } });
    const response = await POST(formContext("email=new%40b.com&password=x"));
    expect(locationOf(response)).not.toBe("/auth/confirm-email");
  });

  it("reports unconfigured Supabase with SUPABASE_NOT_CONFIGURED code", async () => {
    createClient.mockReturnValue(null);
    const response = await POST(formContext("email=new%40b.com&password=secret"));
    expect(errorFrom(response)).toBe("SUPABASE_NOT_CONFIGURED");
  });
});
