// Test-only stub for the `astro:env/server` virtual module, which is provided
// by @astrojs/cloudflare at build/runtime but does not exist under Vitest.
// Aliased in vitest.config.ts (integration project) so modules that read server
// env — e.g. `@/lib/supabase`, `@/lib/supabase-admin`, `@/lib/config-status` —
// can load in Node. Values are sourced from process.env, populated from
// `.dev.vars` by tests/integration/helpers/env.ts (a setupFile that runs first).
export const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.SUPABASE_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
export const ADMIN_EMAILS = process.env.ADMIN_EMAILS ?? "";

export function getSecret(name: string): string | undefined {
  return process.env[name];
}
