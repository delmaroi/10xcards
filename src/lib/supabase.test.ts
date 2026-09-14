import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setEnv, resetEnv } from "@/test/stubs/astro-env-server";
import { makeCookies } from "@/test/factories";

// The interesting code here is OUR cookie adapter, not Supabase's client. Mock the
// SSR factory to capture the options object, then drive the adapter directly.
const createServerClient = vi.fn(() => ({ marker: "supabase-client" }));

vi.mock("@supabase/ssr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/ssr")>();
  return { ...actual, createServerClient: (...args: unknown[]) => createServerClient(...(args as [])) };
});

const { createClient } = await import("@/lib/supabase");

interface CookieAdapter {
  getAll: () => { name: string; value: string }[];
  setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
}

function capturedAdapter(): CookieAdapter {
  const call = createServerClient.mock.calls.at(-1) as unknown as [string, string, { cookies: CookieAdapter }];
  return call[2].cookies;
}

beforeEach(() => {
  createServerClient.mockClear();
  resetEnv();
});

afterEach(() => {
  resetEnv();
});

describe("createClient (SSR Supabase factory)", () => {
  it("returns null when the URL is missing — callers must degrade, not crash", () => {
    setEnv({ SUPABASE_URL: undefined });
    expect(createClient(new Headers(), makeCookies())).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("returns null when the key is missing", () => {
    setEnv({ SUPABASE_KEY: undefined });
    expect(createClient(new Headers(), makeCookies())).toBeNull();
  });

  it("returns null when a value is an empty string", () => {
    setEnv({ SUPABASE_URL: "" });
    expect(createClient(new Headers(), makeCookies())).toBeNull();
  });

  it("builds a client with the configured URL and key", () => {
    setEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_KEY: "anon-key" });
    expect(createClient(new Headers(), makeCookies())).not.toBeNull();
    expect(createServerClient).toHaveBeenCalledWith("https://x.supabase.co", "anon-key", expect.anything());
  });

  it("getAll parses the request's Cookie header", () => {
    const headers = new Headers({ Cookie: "sb-access-token=abc; sb-refresh-token=def" });
    createClient(headers, makeCookies());
    expect(capturedAdapter().getAll()).toEqual([
      { name: "sb-access-token", value: "abc" },
      { name: "sb-refresh-token", value: "def" },
    ]);
  });

  it("passes a present-but-empty cookie through as an empty string", () => {
    // The adapter's `value ?? ""` normalisation exists because @supabase/ssr types
    // the value as optional. In practice a bare flag is DROPPED and `b=` yields "",
    // so this pins the shape the SSR client actually receives.
    createClient(new Headers({ Cookie: "sb-access-token=; flag" }), makeCookies());
    expect(capturedAdapter().getAll()).toEqual([{ name: "sb-access-token", value: "" }]);
  });

  it("getAll returns an empty list when no cookies were sent", () => {
    createClient(new Headers(), makeCookies());
    expect(capturedAdapter().getAll()).toEqual([]);
  });

  it("setAll writes every cookie through to AstroCookies", () => {
    const cookies = makeCookies();
    createClient(new Headers(), cookies);
    capturedAdapter().setAll([
      { name: "sb-access-token", value: "new-access", options: { path: "/" } },
      { name: "sb-refresh-token", value: "new-refresh", options: { path: "/" } },
    ]);
    expect(cookies.get("sb-access-token")?.value).toBe("new-access");
    expect(cookies.get("sb-refresh-token")?.value).toBe("new-refresh");
  });
});
