# Deploy Plan — 10xCards → Cloudflare Workers

## Context

Lesson M1L5, Task 2: a first-deployment runbook for 10xCards, driven by
`context/foundation/infrastructure.md` (platform = Cloudflare Workers) and the
stack in `context/foundation/tech-stack.md`. The app is an Astro 6 SSR project
already wired with `@astrojs/cloudflare` (`output: "server"`, `adapter: cloudflare()`)
and a `wrangler.jsonc`, so this is a **deploy of an existing scaffold**, not new
code. Goal: get 10xCards live at a public Workers URL, with Supabase as the
external data layer, while keeping irreversible/outward actions under human control.

## Ownership model

- **[Human]** — account creation, OAuth logins, production publish, secret values. Outward-facing / hard-to-reverse.
- **[Agent]** — local read-only checks, config edits (reviewed via diff), build, log tailing. Local & reversible.

## Pre-flight — accounts & tools [Human]

1. **Cloudflare account** — dash.cloudflare.com/sign-up, confirm email (free plan is enough).
2. **`wrangler login`** — `npx wrangler login` (browser OAuth). Verify: `npx wrangler whoami`.
3. **Supabase project** — supabase.com → New project, region nearest users (EU). Copy the project URL + `anon` key.
4. **(Optional) `gh auth login`** — only needed for PR/preview workflow; not required for a first manual deploy.

`wrangler` (^4.90.0) is already a devDependency — no global install needed; call via `npx wrangler`.

## Config changes before first deploy [Agent — done in this session]

1. **Renamed the Worker** in `wrangler.jsonc`: `"name": "10x-astro-starter"` → `"name": "10x-cards"`.
2. **Added a `deploy` script** to `package.json`: `"deploy": "astro build && wrangler deploy"`.
3. **No change to `astro.config.mjs`** — `output: "server"` + `adapter: cloudflare()` + the `SUPABASE_URL`/`SUPABASE_KEY` `env.schema` are already correct.

## Secrets [Human sets values, Agent wires config]

Two server-only secrets, declared in `astro.config.mjs` `env.schema`:

| Secret         | Local dev (`.dev.vars`)                            | Production                             |
| -------------- | -------------------------------------------------- | -------------------------------------- |
| `SUPABASE_URL` | copy from `.env.example` → `.dev.vars`, fill value | `npx wrangler secret put SUPABASE_URL` |
| `SUPABASE_KEY` | same                                               | `npx wrangler secret put SUPABASE_KEY` |

- Local: `cp .env.example .dev.vars` then fill real values. `.dev.vars` is gitignored — never commit it.
- Production: `wrangler secret put` (interactive, value never touches the repo or chat). Do NOT put real values in `wrangler.jsonc`.
- Verify after: `npx wrangler secret list` shows both names (values are not shown).

## Deploy sequence

1. **[Agent]** `npm run build` — confirm a clean Astro build.
2. **[Agent]** `npx wrangler whoami` — confirm the session is on the intended Cloudflare account (guard against wrong-account deploy).
3. **[Human]** `npx wrangler deploy` — **this is the production publish**; a human runs it for the first release. This is a Worker deploy (Static Assets via the `ASSETS` binding), **NOT** `wrangler pages deploy` — Pages is not the target for Astro 6.
4. **[Agent]** `npx wrangler tail` during the first requests to the returned `*.workers.dev` URL — watch for the `nodejs_compat` SSR failure mode (see checkpoint below).
5. **[Human]** open the public URL, exercise sign-in/sign-up against Supabase.

## Known-risk checkpoints (from infrastructure.md risk register)

- **`[object Object]` SSR bug**: if server routes return `[object Object]` or crash only on the edge, add `disable_nodejs_process_v2` to `compatibility_flags` in `wrangler.jsonc` and redeploy. Verify secret access on the deployed preview, not just locally.
- **10ms CPU/request (free tier)**: LLM/Supabase calls are I/O and don't count; only surfaces if CPU-heavy work lands on the request path. Not expected for the current auth-only surface.
- **Edge-only failures**: always smoke-test the deployed URL before treating the deploy as done — `astro dev` (workerd) is close but not identical to production.

## Out of scope for this first deploy (note, don't do)

- **CI auto-deploy on merge**: `ci.yml` runs lint+build only. Adding a `wrangler deploy` step on merge to `master` (with a `CLOUDFLARE_API_TOKEN` scoped to this Worker) is a natural follow-up but is CI/CD, deferred.
- **Per-PR preview URLs**: require the repo pushed to GitHub + the Cloudflare GitHub integration. The repo currently has no git remote, so previews aren't wired yet.
- **Hyperdrive**: only if direct Postgres (not the Supabase JS SDK over HTTP) is later needed.

## Verification (deploy is "done" when)

1. `npx wrangler deployments list` shows the new version with a commit/timestamp.
2. The `*.workers.dev` URL loads the app (dashboard redirects to sign-in when unauthenticated — the middleware `PROTECTED_ROUTES` behavior).
3. Sign-up → sign-in against Supabase succeeds end-to-end on the live URL.
4. `npx wrangler secret list` shows `SUPABASE_URL` + `SUPABASE_KEY`.
5. `npx wrangler tail` shows no `nodejs_compat` / secret-access errors during those requests.

## Follow-up housekeeping (optional)

- Update `context/foundation/tech-stack.md`: `deployment_target: cloudflare-pages` → `cloudflare-workers` (stale — research confirmed Astro 6 is Workers-only).
- Commit `AGENTS.md` + `infrastructure.md` + `deploy-plan.md` once the deploy is confirmed.
