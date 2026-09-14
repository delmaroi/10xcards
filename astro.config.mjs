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
  i18n: {
    locales: ["en", "pl"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Force a single React instance across SSR and client bundles.
    // Without this, Vite's SSR dep optimizer pre-bundles React separately
    // in deps_ssr/, causing "Invalid hook call" in I18nProvider and Sonner.
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      exclude: ["@supabase/ssr"],
    },
    ssr: {
      noExternal: ["@supabase/ssr", "react-i18next", "i18next", "sonner"],
      optimizeDeps: {
        exclude: ["react-i18next", "i18next", "sonner"],
      },
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_MODEL: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_SYSTEM_PROMPT: envField.string({ context: "server", access: "secret", optional: true }),
      AI_RATE_LIMIT_HOURLY: envField.number({ context: "server", access: "secret", optional: true }),
      GOOGLE_TTS_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      PONS_API_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      // Comma-separated admin email allowlist (S-04 metrics gate). Not a secret, but
      // server-only. Empty/unset → nobody is admin.
      ADMIN_EMAILS: envField.string({ context: "server", access: "public", optional: true }),
    },
  },
});
