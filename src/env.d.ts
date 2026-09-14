declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    supabase: import("@supabase/supabase-js").SupabaseClient | null;
    locale: import("@/lib/i18n/constants").SupportedLocale;
  }
  interface Runtime {
    env: {
      AI_RATE_LIMIT: KVNamespace;
    };
  }
}

// Bindings reachable via `import { env } from "cloudflare:workers"`, whose type
// is `Cloudflare.Env`. Augment that namespace so `env.AI_RATE_LIMIT` type-checks
// (mirrors App.Runtime.env; also resolves the same gap in generate.ts).
declare namespace Cloudflare {
  interface Env {
    AI_RATE_LIMIT: KVNamespace;
  }
}
