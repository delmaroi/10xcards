// Test-only stub for the `astro:middleware` virtual module, provided by Astro's
// Vite integration at build/dev time but absent under bare Vitest. Aliased in
// vitest.config.ts (integration project) so `@/middleware` can be imported and
// its `onRequest` invoked directly in the middleware auth-gate test.
//
// `defineMiddleware` in Astro is an identity helper (it only exists for types),
// so returning the handler unchanged faithfully reproduces runtime behavior.
import type { MiddlewareHandler } from "astro";

export function defineMiddleware(handler: MiddlewareHandler): MiddlewareHandler {
  return handler;
}
