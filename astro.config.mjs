// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://10x-cards.mariusz-jarzabek.workers.dev",
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // zod trips the Cloudflare workerd dev dep-optimizer ("file does not exist in
    // optimize deps"); exclude it from pre-bundling. Dev-only; build is unaffected.
    optimizeDeps: { exclude: ["zod"] },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // Comma-separated admin email allowlist (S-04 metrics gate). Not a secret, but
      // server-only. Empty/unset → nobody is admin.
      ADMIN_EMAILS: envField.string({ context: "server", access: "public", optional: true }),
    },
  },
});
