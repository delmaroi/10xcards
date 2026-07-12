/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Plain Vitest config (NOT astro/config's getViteConfig): the Cloudflare adapter's
// Vite plugin is incompatible with Vitest's worker environment. We test pure,
// framework-free modules (e.g. src/lib/route-access.ts), so we only need the @/*
// alias — not Astro's full pipeline. Testing modules that import `astro:*` would
// need a separate strategy; see test-plan.md §6.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts"],
  },
});
