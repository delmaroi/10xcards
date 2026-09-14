// Test-only stub for the `cloudflare:workers` virtual module, which is provided
// by @astrojs/cloudflare at build/runtime but does not exist under the Node
// Vitest project. Aliased in vitest.config.ts (node project) so endpoint
// modules that `import { env } from "cloudflare:workers"` can be loaded in
// tests. Tests that exercise rate limiting mock the rate-limit service directly,
// so this empty env is sufficient.
export const env: Record<string, unknown> = {};
