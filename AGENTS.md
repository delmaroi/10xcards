# Repository Guidelines

10xCards is an Astro 6 SSR app (React 19 islands, Tailwind 4, Supabase auth, shadcn/ui) deployed to Cloudflare Workers. `@CLAUDE.md` holds the full architecture and auth-flow detail; this file is the fast-path onboarding.

## Hard rules

- **API routes must `export const prerender = false`.** The app is full SSR (`output: "server"`); a route without it is statically prerendered and breaks at runtime.
- **Every new Supabase table needs RLS enabled** with granular per-operation, per-role policies. See migration conventions in `@CLAUDE.md`.
- **Merge Tailwind classes with `cn()`** from `@/lib/utils` — never concatenate class strings by hand.
- **No Next.js directives** (`"use client"`, etc.); this is Astro + React islands, not Next.

## Project Structure

- `src/pages/` — routes; `src/pages/api/` — endpoints (uppercase `GET`/`POST` exports, zod-validated input).
- `src/components/` — `.astro` for static/layout, `.tsx` React only when interactive; `src/components/ui/` is shadcn ("new-york" variant, add via `npx shadcn@latest add`).
- `src/lib/` — services/helpers (`supabase.ts`, `utils.ts`); `src/middleware.ts` — auth + `context.locals.user`.
- `supabase/migrations/` — SQL named `YYYYMMDDHHmmss_short_description.sql`.
- Shared types go in `src/types.ts`; extracted hooks in `src/components/hooks/`.

## Commands

- `npm run dev` — dev server (Cloudflare workerd runtime).
- `npm run build` — production SSR build.
- `npm run lint` / `npm run lint:fix` — ESLint (type-checked).
- `npm run format` — Prettier (astro + tailwind plugins).
- `npm test` — Vitest (unit).

Husky + lint-staged auto-fix `*.{ts,tsx,astro}` on commit.

## Coding Style

TypeScript strict (`astro/tsconfigs/strict`). Import from `@/*` (maps to `src/*`), not relative `../../`. Server-only secrets (`SUPABASE_URL`, `SUPABASE_KEY`) come from `astro:env/server`; local Cloudflare dev reads `.dev.vars`. Node 22.14.0 (`.nvmrc`).

## Testing

Vitest (`npm test` → `vitest run`); config in `vitest.config.ts` (plain `defineConfig` + `@/*` alias). Tests are **risk-based, not file-based** — start from a risk in `@context/foundation/test-plan.md`, not "cover file X". Reference test: `@src/lib/route-access.test.ts` (behavioral `it.each`; the expected value comes from the design contract, never from what the code currently returns).

- **⚠️ Do not use `getViteConfig` from `astro/config` in the Vitest config** — the Cloudflare adapter's Vite plugin is incompatible with Vitest's worker env. Test **framework-free modules** (no `astro:*` imports); extract pure logic out of `astro:*`-importing files to make it testable (see how `route-access.ts` was pulled out of `middleware.ts`).
- Verify an assertion isn't a mirror: deliberately break the code under test and confirm a test goes red.

**E2E (Playwright):** `npm run test:e2e` — specs + rules live in `@e2e/` (`seed.spec.ts` is the reference shape; `e2e-quality-rules.md` has the locator hierarchy, no-`waitForTimeout`, isolation, and 5 anti-patterns). Prereq: `npm i -D @playwright/test && npx playwright install chromium` (not installed yet). `e2e/` and `playwright.config.ts` are excluded from `tsconfig`/ESLint until then. Use E2E only for browser-level risks whose feature is built; keep auth/routing/DB real and mock only external APIs (LLM) at the network layer.

## Commit & CI

Conventional Commits (`feat:`, `fix:`, `chore:`). CI (`@.github/workflows/ci.yml`) runs lint + build on push/PR to `master` and needs `SUPABASE_URL` / `SUPABASE_KEY` repo secrets. Run `npm run lint && npm run build` before pushing.
