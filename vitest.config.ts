import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";

const alias = { "@": path.resolve(__dirname, "./src") };

// Two projects:
//  - "node": existing React / i18n / AI / CSV tests run in the Node environment.
//  - "workers": the dictionary scraper test runs inside workerd so it exercises
//    the real HTMLRewriter (the scraper relies on Workers-native streaming HTML
//    parsing that cannot be faithfully mocked in Node).
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            ...alias,
            // `cloudflare:workers` is a virtual module supplied at build/runtime
            // by @astrojs/cloudflare; stub it so endpoint modules load under Node.
            "cloudflare:workers": path.resolve(__dirname, "./src/test/cloudflare-workers.stub.ts"),
            // `astro:env/server` is likewise virtual; alias it to the stub
            // with setEnv/resetEnv so unit tests can override env per-case.
            "astro:env/server": path.resolve(__dirname, "./src/test/stubs/astro-env-server.ts"),
          },
        },
        test: {
          name: "node",
          environment: "node",
          globals: true,
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/lib/services/dictionary.test.ts"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      defineWorkersProject({
        resolve: {
          alias: {
            ...alias,
            // `astro:env/server` is virtual under Vitest; alias it to the stub
            // so the Pons service (which reads `PONS_API_SECRET` via `getSecret`)
            // can load under workerd. Tests override `getSecret` via `vi.mock`.
            "astro:env/server": path.resolve(__dirname, "./src/test/astro-env-server.stub.ts"),
          },
        },
        test: {
          name: "workers",
          globals: true,
          include: ["src/lib/services/dictionary.test.ts", "src/lib/services/dictionary-de.test.ts"],
          poolOptions: {
            workers: {
              miniflare: {
                compatibilityDate: "2026-05-08",
                compatibilityFlags: ["nodejs_compat"],
              },
            },
          },
        },
      }),
      {
        // "integration": API authorization tests against a real local Supabase.
        plugins: [react()],
        resolve: {
          alias: {
            ...alias,
            "cloudflare:workers": path.resolve(__dirname, "./src/test/cloudflare-workers.stub.ts"),
            "astro:env/server": path.resolve(__dirname, "./src/test/astro-env-server.stub.ts"),
            "astro:middleware": path.resolve(__dirname, "./src/test/astro-middleware.stub.ts"),
          },
        },
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/helpers/env.ts"],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
