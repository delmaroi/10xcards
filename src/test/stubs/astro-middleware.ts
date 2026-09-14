// Test stub for `astro:middleware`. At runtime `defineMiddleware` is an identity
// helper that exists purely to attach types, so the stub is the same identity.
import type { MiddlewareHandler } from "astro";

export function defineMiddleware(handler: MiddlewareHandler): MiddlewareHandler {
  return handler;
}
