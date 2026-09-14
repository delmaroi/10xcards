// Default-deny route-access policy: every route is protected EXCEPT the public
// allowlist below. Pure and framework-free so it can be unit-tested directly
// (no astro:* imports, no mocks). `src/middleware.ts` consumes this.
const PUBLIC_EXACT = ["/"];
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/"];

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  // Static assets must pass through untouched (never redirect them).
  if (pathname.startsWith("/_astro/")) return true;
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return true;
  return false;
}

/**
 * Is `pathname` an API endpoint? API callers are `fetch()`, not browsers: an auth
 * failure must answer 401 JSON, because a 302 to the sign-in page is followed
 * transparently and arrives at the caller as a 200 HTML body.
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}
