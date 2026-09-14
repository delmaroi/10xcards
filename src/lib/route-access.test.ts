import { describe, it, expect } from "vitest";
import { isPublicRoute, isApiRoute } from "@/lib/route-access";

// R3 (auth-gate regression) guard. Oracle = the design contract (default-deny
// allowlist), NOT what the code currently returns. These assertions fail if the
// allowlist is loosened (a product route becomes public) or a required public
// entry is dropped (login would deadlock).

describe("route-access policy (R3 auth gate)", () => {
  describe("public routes — reachable without a session", () => {
    it.each([
      "/", // landing
      "/auth/signin",
      "/auth/signup",
      "/auth/confirm-email",
      "/api/auth/signin",
      "/api/auth/signout",
      "/_astro/client.abc123.js", // build asset
      "/favicon.png", // static file (extension rule)
    ])("treats %s as public", (path) => {
      expect(isPublicRoute(path)).toBe(true);
    });
  });

  describe("protected routes — require a session (default-deny)", () => {
    it.each([
      "/dashboard", // the only product route that exists today
      "/deck", // does NOT exist yet — must be protected by default
      "/generate", // future S-01 surface
      "/review", // future S-04 surface
      "/api/generate", // future product API — not under /api/auth/*
      "/api/sessions/123/save", // future product API
    ])("treats %s as protected", (path) => {
      expect(isPublicRoute(path)).toBe(false);
    });

    it("protects an arbitrary unknown route (the default-deny guarantee)", () => {
      // The load-bearing contract: a route nobody has classified is protected.
      expect(isPublicRoute("/some/route/invented/later")).toBe(false);
    });
  });

  describe("allowlist is scoped, not substring-broad", () => {
    it("does not treat a product route that merely contains 'auth' as public", () => {
      // Guards against a widened check (e.g. `.includes('/auth/')` instead of a prefix).
      expect(isPublicRoute("/dashboard/auth/settings")).toBe(false);
    });
  });

  describe("API-route classification (drives 401-vs-redirect)", () => {
    it.each(["/api/generate", "/api/flashcards", "/api/flashcards/abc-123", "/api/auth/signin"])(
      "treats %s as an API route",
      (path) => {
        expect(isApiRoute(path)).toBe(true);
      },
    );

    it.each(["/dashboard", "/deck", "/", "/apiary", "/auth/signin"])("treats %s as a page route", (path) => {
      expect(isApiRoute(path)).toBe(false);
    });

    it("does not match a page route that merely contains /api/", () => {
      // Prefix, not substring: a redirect must stay a redirect for real pages.
      expect(isApiRoute("/docs/api/reference")).toBe(false);
    });
  });
});
