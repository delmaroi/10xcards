---
project: 10x-cards
researched_at: 2026-07-07
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 (SSR) + React 19 islands
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

For a cost-sensitive, single-region, stateless SSR MVP, Cloudflare wins on every axis: it is free at this scale (100k requests/**day**), it is already the project's adapter (`@astrojs/cloudflare` v13 + `wrangler.jsonc` are in the repo), and it is the platform you already know. Zero migration, zero cost, full CLI + MCP operability. External Supabase Postgres stays as the data layer.

## Platform Comparison

| Platform               | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration      | Cost @ MVP                       | Total   |
| ---------------------- | --------- | ------------------ | ------------------- | ----------------- | ---------------------- | -------------------------------- | ------- |
| **Cloudflare Workers** | Pass      | Pass               | Pass                | Pass              | Pass (GA)              | **$0** (100k req/day free)       | **5/5** |
| Netlify                | Pass      | Pass               | Pass                | Pass              | Pass (GA)              | free (300 credits) / ~$19 Pro    | 5/5     |
| Render                 | Pass      | Pass               | Pass                | Pass              | Pass (GA)              | free (cold start) / $7 always-on | ~4.5    |
| Vercel                 | Pass      | Pass               | Pass                | Pass              | Partial (beta)         | Hobby non-commercial / $20 Pro   | ~4.5    |
| Railway                | Pass      | Partial            | Pass                | Pass              | Partial (beta)         | $5/mo floor, no free             | ~4      |
| Fly.io                 | Pass      | Partial            | Pass                | Pass              | Partial (experimental) | no free, ~$2–5/mo                | ~3.5    |

Notes per platform:

- **Cloudflare** — `wrangler deploy`/`rollback`/`tail` cover the full ops loop; `llms.txt` + markdown docs; multiple GA MCP servers (docs, bindings, observability). Free tier is the most generous here. Native adapter already wired.
- **Netlify** — Astro 6 GA (adapter v7), official MCP GA (June 2025), CLI defaults to a draft deploy (`--prod` required — a safe gate). Would require swapping to `@astrojs/netlify` and carries no existing team familiarity.
- **Render** — Astro 6 SSR as a Web Service via `@astrojs/node`, MCP GA (Aug 2025). Free web services spin down after 15 min idle → 30–60s cold start; $7 Starter removes it. Adapter swap required.
- **Vercel** — best DX, `llms.txt`/`.md` docs, but Hobby tier is **non-commercial only** (Pro $20/mo for anything revenue-generating) and Vercel MCP is public beta. Adapter swap required.
- **Railway** — container PaaS, WebSockets work, but no scale-to-zero (idle still burns the $5/mo Hobby credit) and MCP is beta. Overkill for stateless SSR.
- **Fly.io** — strong for persistent/WebSocket workloads (not needed here); requires a Dockerfile, no free tier, MCP experimental.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Free at this scale, already the project's adapter, and a platform the developer knows. Full CLI (`wrangler`) and GA MCP servers give an agent complete read/write operability. External Supabase is a first-class integration (over HTTP via the Supabase JS SDK, or via Hyperdrive for direct Postgres).

#### 2. Netlify

Also 5/5 with a GA MCP server and a genuinely safe CLI default (draft-unless-`--prod`). The gap: it needs an adapter swap and there's no existing familiarity — pure switching cost with no offsetting benefit given Cloudflare is free and already wired.

#### 3. Vercel

The most polished DX of the three, but the Hobby tier's non-commercial restriction means a real product pays $20/mo, its MCP is still beta, and it too requires an adapter swap.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Pages→Workers transition chaos.** `@astrojs/cloudflare` v13 dropped Pages entirely (deprecated April 2025). This project's own `tech-stack.md` still says `cloudflare-pages` — the contract is stale on day 0. Older "Deploy Astro to Pages" tutorials lead into a dead end.
2. **`nodejs_compat` sharp edges.** Documented bug: SSR routes return `[object Object]` without the `disable_nodejs_process_v2` flag; `astro:env` secrets sometimes need `nodejs_compat_populate_process_env` (open issue). Some npm packages relying on Node built-ins run locally but fail on the edge.
3. **10ms CPU/request ceiling on the free tier.** LLM/Supabase calls are I/O (don't count), but any CPU-heavy work (parsing, crypto, large JSON) does — and it fails silently until hit.
4. **Direct Postgres needs Hyperdrive.** Cloudflare's recommended path for direct Postgres from Workers is Hyperdrive + `pg`/postgres.js, not the Supabase JS client — an extra moving part if the app grows past auth-over-HTTP.
5. **Primitive lock-in.** KV-backed sessions, `wrangler.jsonc` secrets format, and bindings are Cloudflare-shaped; migrating off later means rewriting the session/secrets layer.

### Pre-Mortem — How This Could Fail

The deploy went smoothly — `wrangler deploy` just worked. Trouble began as flashcard generation grew: the LLM-orchestration endpoint occasionally exceeded the free-tier 10ms CPU ceiling under real usage, returning errors that appeared **only on the edge, never locally** on `astro dev`. Debugging took days because the failure mode differed between workerd-dev and production. Earlier, the team had followed a 2024 "Cloudflare Pages" blog, stood up a Pages project, then discovered Astro 6's adapter is Workers-only — a mid-project migration. Supabase auth worked over HTTP, but a later analytics feature needed direct Postgres, forcing an unbudgeted Hyperdrive setup. Sessions lived in an auto-provisioned KV namespace; when they evaluated a cheaper host, they found sessions, secrets, and bindings were all Cloudflare-shaped. The platform wasn't wrong — but the assumption "edge = free and simple" hid the CPU ceiling, the Node-compat edges, and the lock-in.

### Unknown Unknowns

- `tech-stack.md` says `cloudflare-pages`, but the correct 2026 target is Workers Static Assets. Verify what you actually deploy before following any guide.
- Free-tier CPU is 10ms **per request** (not wall-clock). External LLM/DB calls are I/O and don't count; CPU-bound work does, and it's silent until you hit it.
- `astro dev` now runs on workerd, but fidelity to production isn't 100% for every Node built-in — some bugs surface only on deployed Workers.
- Secrets: `wrangler.jsonc` vs `wrangler secret put` — committing the wrong thing leaks; the `astro:env` + Workers-secret interplay has open issues.
- Decide early: Supabase JS SDK path vs Hyperdrive + `pg`. Switching later risks a rewrite of the data-access layer.

## Operational Story

- **Preview deploys**: `wrangler versions upload` creates a preview URL per version; GitHub integration builds per-PR preview Workers. Protect private previews with Cloudflare Access if the app shouldn't be public pre-launch.
- **Secrets**: `SUPABASE_URL` / `SUPABASE_KEY` are server-only secrets declared in `astro.config.mjs` `env.schema`. Local Cloudflare dev reads `.dev.vars` (gitignored); production uses `wrangler secret put` (or the dashboard). Never commit real values to `wrangler.jsonc`. Access = whoever holds the Cloudflare account/scoped API token.
- **Rollback**: `wrangler rollback [version-id]` (defaults to the immediately prior version) — one command, ~1 minute. Caveat: rollback reverts code, not Supabase schema migrations; DB changes must be rolled back separately.
- **Approval**: An agent may deploy previews, tail logs, and list secrets/versions unattended. A human performs: production publish for the first release, secret rotation, and any destructive Cloudflare action (delete Worker, drop KV namespace). Supabase table drops / destructive migrations are human-only.
- **Logs**: `wrangler tail` (live stream) and `wrangler deployments list` (history) read-only from the terminal; the Observability MCP server exposes the same data as structured tools.

## Risk Register

| Risk                                                         | Source                              | Likelihood | Impact | Mitigation                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Following stale "Pages" guidance / stale tech-stack contract | Devil's advocate / Unknown unknowns | M          | M      | Deploy to Workers (Static Assets); update `tech-stack.md` `deployment_target` to `cloudflare-workers`; ignore pre-2025 Pages tutorials |
| `[object Object]` / secret-access bugs under `nodejs_compat` | Devil's advocate                    | M          | M      | Set `disable_nodejs_process_v2`; track astro#15434; verify `astro:env` secret access on a deployed preview, not just locally           |
| Free-tier 10ms CPU ceiling hit by LLM-orchestration endpoint | Pre-mortem                          | L–M        | M      | Keep CPU-heavy work off the request path; move heavy work to the client or a queue; upgrade to $5 paid tier if hit                     |
| Edge-only failures invisible on `astro dev`                  | Pre-mortem / Unknown unknowns       | M          | M      | Always smoke-test a deployed preview URL before production publish; `wrangler tail` during first requests                              |
| Direct Postgres needs Hyperdrive (not Supabase JS client)    | Devil's advocate                    | L          | M      | Stay on Supabase JS SDK over HTTP for MVP; adopt Hyperdrive only when direct Postgres is genuinely required                            |
| Platform lock-in (KV sessions, wrangler secrets, bindings)   | Devil's advocate                    | L          | M      | Accept for MVP; keep session/secret access behind a thin abstraction if portability later matters                                      |

## Getting Started

Validated against the versions pinned in this repo (`@astrojs/cloudflare` ^13.5.0, `wrangler` ^4.90.0, `astro` ^6.3.1).

1. **Create a Cloudflare account** at dash.cloudflare.com/sign-up (free plan is enough) and confirm your email.
2. **Authenticate wrangler**: `npx wrangler login` (opens an OAuth flow in the browser). Verify with `npx wrangler whoami`.
3. **Create a Supabase project** at supabase.com → New project (region nearest your users). Copy the project URL and `anon` key.
4. **Set secrets**: for local dev, `cp .env.example .dev.vars` and fill `SUPABASE_URL` / `SUPABASE_KEY`; for production, `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (or set them in the Cloudflare dashboard).
5. **Build & deploy**: `npm run build` then `npx wrangler deploy`. This is a Worker deploy (Static Assets), NOT `wrangler pages deploy` — the two are different commands and Pages is not the target for Astro 6.
6. **(Optional) `gh auth login`** so the agent can open PRs and read per-PR preview build status.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
