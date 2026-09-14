import { describe, it, expect, vi } from "vitest";

// config-status reads env at MODULE LOAD, so each case needs a fresh registry.
// resetModules() also resets the env stub, hence re-importing it inside the helper:
// the top-level stub instance is a different module object after the reset.
async function loadWith(env: { SUPABASE_URL?: string; SUPABASE_KEY?: string }) {
  vi.resetModules();
  const stub = await import("@/test/stubs/astro-env-server");
  stub.setEnv({ SUPABASE_URL: undefined, SUPABASE_KEY: undefined, ...env });
  return import("@/lib/config-status");
}

describe("config-status banner data", () => {
  it("reports Supabase configured when both URL and key are present", async () => {
    const { configStatuses, missingConfigs } = await loadWith({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_KEY: "anon-key",
    });
    expect(configStatuses[0].configured).toBe(true);
    expect(missingConfigs).toEqual([]);
  });

  it("reports missing config when the key is absent", async () => {
    const { missingConfigs } = await loadWith({ SUPABASE_URL: "https://x.supabase.co" });
    expect(missingConfigs).toHaveLength(1);
    expect(missingConfigs[0].name).toBe("Supabase");
  });

  it("reports missing config when the URL is absent", async () => {
    const { missingConfigs } = await loadWith({ SUPABASE_KEY: "anon-key" });
    expect(missingConfigs).toHaveLength(1);
  });

  it("treats an empty-string value as unconfigured, not as set", async () => {
    // An empty secret is the classic "deployed but forgot the value" case; it must
    // surface the banner rather than let the app pretend auth works.
    const { missingConfigs } = await loadWith({ SUPABASE_URL: "", SUPABASE_KEY: "anon-key" });
    expect(missingConfigs).toHaveLength(1);
  });

  it("carries the operator-facing message and docs link", async () => {
    const { configStatuses } = await loadWith({});
    expect(configStatuses[0].messageKey).toMatch(/Supabase/i);
    expect(configStatuses[0].docsUrl).toMatch(/^https:\/\//);
  });
});
