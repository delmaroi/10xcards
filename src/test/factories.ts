// Test doubles for the Astro request objects our endpoints and middleware receive.
// Astro's `APIContext` is far larger than any handler uses, so each factory builds
// the fields that are actually read and casts once, here, instead of in every test.
import { vi } from "vitest";
import type { APIContext, AstroCookies, MiddlewareNext } from "astro";

export interface FakeUser {
  id: string;
  email?: string;
}

/** In-memory `AstroCookies`: enough surface for the Supabase SSR client's setAll/getAll. */
export function makeCookies(initial: Record<string, string> = {}): AstroCookies {
  const jar = new Map<string, string>(Object.entries(initial));
  const cookies = {
    get: (key: string) => {
      const value = jar.get(key);
      return value === undefined
        ? undefined
        : {
            value,
            json: () => JSON.parse(value) as unknown,
            number: () => Number(value),
            boolean: () => value === "true",
          };
    },
    has: (key: string) => jar.has(key),
    set: (key: string, value: string) => jar.set(key, value),
    delete: (key: string) => jar.delete(key),
    merge: () => undefined,
    headers: () => [][Symbol.iterator](),
  };
  return cookies as unknown as AstroCookies;
}

export interface ContextOptions {
  url?: string;
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  user?: FakeUser | null;
  params?: Record<string, string | undefined>;
}

const DEFAULT_ORIGIN = "http://localhost:4321";

/** Build an `APIContext` for an endpoint under test. `redirect` returns a real 302 Response. */
export function makeApiContext(opts: ContextOptions = {}): APIContext {
  const url = new URL(opts.url ?? "/", DEFAULT_ORIGIN);
  const request = new Request(url, {
    method: opts.method ?? "GET",
    headers: opts.headers,
    body: opts.body ?? null,
  });

  const context = {
    request,
    url,
    params: opts.params ?? {},
    cookies: makeCookies(),
    locals: { user: opts.user ?? null },
    redirect: (path: string, status = 302) => new Response(null, { status, headers: { Location: path } }),
  };
  return context as unknown as APIContext;
}

/**
 * `next()` double for middleware: a spy (tests assert it was NOT reached when the
 * gate rejects) resolving to a sentinel body the assertions can match.
 */
export function makeNext(body = "downstream"): MiddlewareNext {
  return vi.fn(() => Promise.resolve(new Response(body, { status: 200 })));
}

/** Read a redirect target regardless of whether Astro or our double produced it. */
export function locationOf(response: Response): string | null {
  return response.headers.get("Location");
}
