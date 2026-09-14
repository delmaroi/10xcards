// Test stub for Astro's `astro:env/server` virtual module. That module only exists
// inside the Astro/Vite pipeline, so importing anything that reads env (the Supabase
// factory, the generate endpoint, config-status) would explode under plain Vitest.
// `vitest.config.ts` aliases the virtual id here.
//
// The exports are `let` bindings on purpose: ES module live bindings mean a consumer
// that already imported them sees `setEnv()` updates without re-importing. Modules
// that read env at import time (config-status) still need `vi.resetModules()`.

const DEFAULTS = {
  SUPABASE_URL: "https://stub.supabase.test" as string | undefined,
  SUPABASE_KEY: "stub-anon-key" as string | undefined,
  SUPABASE_SERVICE_ROLE_KEY: "" as string | undefined,
  OPENROUTER_API_KEY: "stub-openrouter-key" as string | undefined,
  OPENROUTER_MODEL: "" as string | undefined,
  OPENROUTER_SYSTEM_PROMPT: "" as string | undefined,
  AI_RATE_LIMIT_HOURLY: undefined as number | undefined,
  GOOGLE_TTS_API_KEY: "" as string | undefined,
  PONS_API_SECRET: "" as string | undefined,
  ADMIN_EMAILS: "" as string | undefined,
};

export let SUPABASE_URL: string | undefined = DEFAULTS.SUPABASE_URL;
export let SUPABASE_KEY: string | undefined = DEFAULTS.SUPABASE_KEY;
export let SUPABASE_SERVICE_ROLE_KEY: string | undefined = DEFAULTS.SUPABASE_SERVICE_ROLE_KEY;
export let OPENROUTER_API_KEY: string | undefined = DEFAULTS.OPENROUTER_API_KEY;
export let OPENROUTER_MODEL: string | undefined = DEFAULTS.OPENROUTER_MODEL;
export let OPENROUTER_SYSTEM_PROMPT: string | undefined = DEFAULTS.OPENROUTER_SYSTEM_PROMPT;
export let AI_RATE_LIMIT_HOURLY: number | undefined = DEFAULTS.AI_RATE_LIMIT_HOURLY;
export let GOOGLE_TTS_API_KEY: string | undefined = DEFAULTS.GOOGLE_TTS_API_KEY;
export let PONS_API_SECRET: string | undefined = DEFAULTS.PONS_API_SECRET;
export let ADMIN_EMAILS: string | undefined = DEFAULTS.ADMIN_EMAILS;

export function getSecret(name: string): string | undefined {
  return process.env[name];
}

export function setEnv(next: Partial<Record<string, string | number | undefined>>): void {
  if ("SUPABASE_URL" in next) SUPABASE_URL = next.SUPABASE_URL as string | undefined;
  if ("SUPABASE_KEY" in next) SUPABASE_KEY = next.SUPABASE_KEY as string | undefined;
  if ("SUPABASE_SERVICE_ROLE_KEY" in next)
    SUPABASE_SERVICE_ROLE_KEY = next.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if ("OPENROUTER_API_KEY" in next) OPENROUTER_API_KEY = next.OPENROUTER_API_KEY as string | undefined;
  if ("OPENROUTER_MODEL" in next) OPENROUTER_MODEL = next.OPENROUTER_MODEL as string | undefined;
  if ("OPENROUTER_SYSTEM_PROMPT" in next)
    OPENROUTER_SYSTEM_PROMPT = next.OPENROUTER_SYSTEM_PROMPT as string | undefined;
  if ("AI_RATE_LIMIT_HOURLY" in next) AI_RATE_LIMIT_HOURLY = next.AI_RATE_LIMIT_HOURLY as number | undefined;
  if ("GOOGLE_TTS_API_KEY" in next) GOOGLE_TTS_API_KEY = next.GOOGLE_TTS_API_KEY as string | undefined;
  if ("PONS_API_SECRET" in next) PONS_API_SECRET = next.PONS_API_SECRET as string | undefined;
  if ("ADMIN_EMAILS" in next) ADMIN_EMAILS = next.ADMIN_EMAILS as string | undefined;
}

export function resetEnv(): void {
  Object.assign(
    {
      SUPABASE_URL,
      SUPABASE_KEY,
      SUPABASE_SERVICE_ROLE_KEY,
      OPENROUTER_API_KEY,
      OPENROUTER_MODEL,
      OPENROUTER_SYSTEM_PROMPT,
      AI_RATE_LIMIT_HOURLY,
      GOOGLE_TTS_API_KEY,
      PONS_API_SECRET,
      ADMIN_EMAILS,
    },
    DEFAULTS,
  );
  SUPABASE_URL = DEFAULTS.SUPABASE_URL;
  SUPABASE_KEY = DEFAULTS.SUPABASE_KEY;
  SUPABASE_SERVICE_ROLE_KEY = DEFAULTS.SUPABASE_SERVICE_ROLE_KEY;
  OPENROUTER_API_KEY = DEFAULTS.OPENROUTER_API_KEY;
  OPENROUTER_MODEL = DEFAULTS.OPENROUTER_MODEL;
  OPENROUTER_SYSTEM_PROMPT = DEFAULTS.OPENROUTER_SYSTEM_PROMPT;
  AI_RATE_LIMIT_HOURLY = DEFAULTS.AI_RATE_LIMIT_HOURLY;
  GOOGLE_TTS_API_KEY = DEFAULTS.GOOGLE_TTS_API_KEY;
  PONS_API_SECRET = DEFAULTS.PONS_API_SECRET;
  ADMIN_EMAILS = DEFAULTS.ADMIN_EMAILS;
}
