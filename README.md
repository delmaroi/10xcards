# 10xCards

Wklej notatki — AI zamienia je w fiszki, ty decydujesz, które trafiają do talii, a algorytm
spaced repetition pilnuje, kiedy je powtórzyć.

Produkt powstał dla studenta, który tuż przed sesją ma dużą partię materiału i mało czasu.
Barierą wejścia w spaced repetition nie jest sam algorytm powtórek, lecz mozolne ręczne
przepisywanie materiału na fiszki. 10xCards zdejmuje ten krok: wklejasz tekst, dostajesz
gotowe propozycje par pytanie–odpowiedź i recenzujesz je jedną decyzją na fiszkę.

Pełne wymagania produktowe: [`context/foundation/prd.md`](context/foundation/prd.md).

## Co potrafi

**Rdzeń MVP — pętla nauki**

- **Generowanie z tekstu** — wklejony fragment notatek trafia do modelu LLM (OpenRouter,
  tool-calling), który zwraca atomowe pary pytanie/odpowiedź. `src/lib/services/ai.ts`.
- **Triage propozycji** — każdą fiszkę akceptujesz, edytujesz albo odrzucasz osobno.
  Do bazy trafiają wyłącznie te zaakceptowane, jednym atomowym zapisem.
- **Talie (zestawy)** — pełny CRUD na zestawach i fiszkach, każdy rekord przypięty do
  właściciela (`user_id` + RLS po stronie Postgresa).
- **Powtórki FSRS** — harmonogram liczy biblioteka `ts-fsrs`, opakowana w jeden moduł
  `src/lib/srs.ts`; ocena karty i zapis nowego stanu idą przez transakcyjne RPC
  `submit_card_review`.
- **Metryki sukcesu** — zbierany jest wskaźnik akceptacji fiszek AI i udział fiszek
  tworzonych z AI (PRD: ≥ 75%), widoczne pod `/admin/metrics` dla allowlisty `ADMIN_EMAILS`.

**Poza minimum MVP**

- Dwujęzyczny interfejs PL/EN (`i18next`, wybór zapamiętany w profilu użytkownika).
- Podgląd słownikowy słowa (PL i DE) jako szybka droga do fiszki.
- Synteza mowy (Google TTS) z wyborem głosu w ustawieniach.
- Udostępnianie zestawu linkiem (share token) i przejmowanie go na własne konto.
- Dokumentacja API w Scalar pod `/docs/api`.
- Limit generowań na godzinę per użytkownik (Cloudflare KV), żeby koszt LLM był ograniczony.

## Tech Stack

- [Astro](https://astro.build/) v6 — SSR, routing plikowy, wyspy interaktywności
- [React](https://react.dev/) v19 — wyspy UI (formularze, triage propozycji, sesja powtórek)
- [TypeScript](https://www.typescriptlang.org/) v5 — `strict`
- [Tailwind CSS](https://tailwindcss.com/) v4 + [Radix UI](https://www.radix-ui.com/) — warstwa widoku
- [Supabase](https://supabase.com/) — Auth (e-mail/hasło + Google SSO), Postgres z RLS, migracje
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — algorytm spaced repetition (FSRS)
- [OpenRouter](https://openrouter.ai/) — dostawca modelu do generowania fiszek
- [Zod](https://zod.dev/) v4 — walidacja wejścia na granicy API
- [Cloudflare Workers](https://workers.cloudflare.com/) + KV — runtime brzegowy i licznik rate-limitu
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) — testy jednostkowe/komponentowe i E2E

## Prerequisites

- Node.js v22.14.0 (zgodnie z `.nvmrc`)
- npm (w komplecie z Node.js)
- Docker (~7 GB RAM) — jeśli chcesz uruchomić Supabase lokalnie

## Getting Started

1. Sklonuj repozytorium i wejdź do katalogu:

```bash
git clone <adres-twojego-repozytorium> 10xCards
cd 10xCards
```

2. Zainstaluj zależności:

```bash
npm install
```

3. Uruchom Supabase i skonfiguruj zmienne środowiskowe — patrz [Supabase Configuration](#supabase-configuration).

4. Utwórz `.dev.vars` z sekretami dla lokalnego runtime'u Cloudflare:

```bash
cp .env.example .dev.vars
```

5. Wystartuj serwer deweloperski:

```bash
npm run dev
```

Bez `OPENROUTER_API_KEY` aplikacja uruchomi się i pozwoli ręcznie zarządzać taliami oraz
robić powtórki — samo generowanie AI zwróci błąd konfiguracji.

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run typecheck` - Run `astro check`
- `npm test` - Run the unit + component suite (Vitest)
- `npm run test:watch` - Vitest in watch mode
- `npm run test:coverage` - Unit suite with coverage, enforcing the thresholds in `vitest.config.ts`
- `npm run test:e2e` - Run the Playwright suite (`-- --project=logged-out` for the no-account subset)

## Routes

| Ścieżka | Opis |
| --- | --- |
| `/` | Strona startowa (publiczna) |
| `/auth/signin`, `/auth/signup`, `/auth/confirm-email` | Logowanie, rejestracja, ekran po rejestracji (publiczne) |
| `/dashboard` | Lista talii użytkownika z licznikami fiszek |
| `/sets/[id]`, `/sets/[id]/browse`, `/sets/[id]/review` | Talia: podgląd, przeglądanie fiszek, sesja powtórek |
| `/generate` | Wklejenie tekstu i triage propozycji AI |
| `/settings` | Język interfejsu, głos TTS, własny prompt, zmiana hasła, usunięcie konta |
| `/lookup_word`, `/lookup_word_de` | Podgląd słownikowy (PL / DE) |
| `/share/[token]` | Odbiór udostępnionej talii |
| `/admin/metrics` | Metryki sukcesu — tylko dla adresów z `ADMIN_EMAILS` |
| `/docs/api` | Dokumentacja API (Scalar) |

## Project Structure

```md
.
├── src/
│ ├── pages/            # Astro pages
│ │ └── api/            # API endpoints (sets, flashcards, generate, review, auth, share…)
│ ├── components/       # UI components (Astro & React islands)
│ ├── layouts/          # Astro layouts
│ ├── lib/
│ │ ├── services/       # Domain services (sets, flashcards, reviews, ai, dictionary, tts)
│ │ ├── i18n/           # i18next setup + PL/EN locales
│ │ └── srs.ts          # The only module that touches ts-fsrs
│ ├── middleware.ts     # Auth gate + locale resolution
│ └── tests/            # API endpoint tests (kept out of src/pages on purpose)
├── e2e/                # Playwright specs
├── supabase/migrations/# Database schema, RLS policies, RPC functions
├── context/            # 10x foundation: PRD, roadmap, test plan, per-change plans
├── public/             # Public assets
└── wrangler.jsonc      # Cloudflare Workers config
```

## Testing

Two layers, both gated in CI.

### Unit and component tests (Vitest)

```bash
npm test                 # everything
npm run test:coverage    # + coverage report, fails under the configured thresholds
npx vitest run src/lib   # one area
```

- **Pure logic and handlers** — co-located `*.test.ts` beside the module (`src/lib/`).
- **API endpoints** — `src/tests/api/`. Kept OUT of `src/pages/` on purpose: Astro's
  file-based routing would otherwise publish a test file as a live route.
- **React components** — co-located `*.test.tsx` with a `// @vitest-environment jsdom`
  docblock on the first line (Vitest 4 removed `environmentMatchGlobs`).
- **Shared doubles** — `src/test/`: `factories.ts` (Astro `APIContext`, cookies, `next()`),
  `supabase-stub.ts` (chainable query double), `watch-submit.ts`, and `stubs/` for the
  `astro:*` virtual modules.

`astro:env/server` and `astro:middleware` don't exist outside the Astro/Vite pipeline, so
`vitest.config.ts` aliases them to stubs. That is what makes `src/middleware.ts` and the API
endpoints testable without booting a server. Note the alias is `@/` and not `@` — a bare `@`
also swallows scoped packages such as `@testing-library/react`.

### End-to-end tests (Playwright)

```bash
npm run test:e2e -- --project=logged-out   # no account needed
npm run test:e2e                            # everything, needs a test account
```

The `logged-out` project (`seed`, `auth-gate`, `auth-forms`) needs no credentials and runs in
CI. The authenticated project (`review`, `deck`) needs a **test** account — never production:

```bash
E2E_EMAIL=test@example.com E2E_PASSWORD=... npm run test:e2e
```

Two sharp edges worth knowing before adding a spec: await `waitForIslands(page)` from
`e2e/helpers.ts` after `goto()` on any page with a `client:load` island (Playwright can click
the not-yet-hydrated markup and submit the form natively), and pass
`headers: { Origin: baseURL }` on `request.post()` — Astro's CSRF check answers 403 without it.

## Supabase Configuration

Supabase dostarcza uwierzytelnianie **oraz** bazę danych (talie, fiszki, log powtórek,
preferencje, statystyki generowania). Zmienne środowiskowe są zadeklarowane w schemacie
`astro:env` w `astro.config.mjs` i traktowane jako **sekrety serwerowe** — nigdy nie trafiają
do klienta.

### First-time setup (local, no cloud project needed)

Wymaga [Dockera](https://www.docker.com/) i ~7 GB RAM. Konfiguracja projektu (`supabase/`)
jest już w repozytorium — nie wywołuj `supabase init`.

1. Utwórz plik `.env`:

```bash
cp .env.example .env
```

2. Wystartuj lokalny stack (za pierwszym razem pobiera obrazy Dockera). Migracje z
   `supabase/migrations/` — schemat, polityki RLS i funkcje RPC — zostaną zastosowane
   automatycznie:

```bash
npx supabase start
```

3. Skopiuj dane wypisane przez CLI do `.env` i `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. Aby zresetować bazę do stanu z migracji (czyści dane):

```bash
npx supabase db reset
```

5. Zatrzymanie stacku:

```bash
npx supabase stop
```

Lokalne Studio: `http://localhost:54323`.

### Using a cloud Supabase project instead

Dla hostowanego projektu ustaw `SUPABASE_URL` i `SUPABASE_KEY` (zakładka Settings → API
w panelu Supabase) i wypchnij migracje przez `npx supabase db push`.

### Environment variables

Wszystkie są opcjonalne w schemacie — brakująca zmienna wyłącza powiązaną funkcję, zamiast
wywracać cały build.

| Zmienna | Do czego służy | Bez niej |
| --- | --- | --- |
| `SUPABASE_URL` | URL projektu Supabase | Brak logowania i zapisu danych |
| `SUPABASE_KEY` | Klucz `anon` | j.w. |
| `SUPABASE_SERVICE_ROLE_KEY` | Operacje administracyjne (m.in. usunięcie konta) | Usunięcie konta niedostępne |
| `OPENROUTER_API_KEY` | Dostawca LLM do generowania fiszek | Generowanie AI zwraca błąd konfiguracji |
| `OPENROUTER_MODEL` | Nadpisanie domyślnego modelu | Używany model domyślny |
| `OPENROUTER_SYSTEM_PROMPT` | Nadpisanie promptu systemowego | Używany prompt domyślny |
| `AI_RATE_LIMIT_HOURLY` | Limit generowań na godzinę per użytkownik | Domyślnie 10 |
| `GOOGLE_TTS_API_KEY` | Synteza mowy | Odtwarzanie wymowy wyłączone |
| `PONS_API_SECRET` | Słownik niemiecki (PONS) | `/lookup_word_de` bez wyników |
| `ADMIN_EMAILS` | Lista adresów (po przecinku) z dostępem do metryk | Nikt nie jest administratorem |

`.dev.vars` to sekrety dla lokalnego runtime'u Cloudflare (`npm run dev`), `.env` — dla
Supabase CLI i narzędzi. Oba pliki są w `.gitignore`.

### Email confirmation in local development

Domyślnie Supabase wymaga potwierdzenia adresu przed pierwszym logowaniem. Aby pominąć to
lokalnie: **Authentication → Email → Confirm email** → wyłącz.

### Auth and route protection

Logowanie działa na dwa sposoby: e-mail + hasło oraz Google SSO (`/api/auth/google` →
`/api/auth/callback`).

Bramkę trzyma `src/middleware.ts`, na dwóch listach:

- `PROTECTED_PAGE_ROUTES` — niezalogowany dostaje przekierowanie na `/auth/signin`.
- `PROTECTED_API_ROUTES` — niezalogowany dostaje **401 JSON**, nigdy 302 na HTML. To celowe:
  `fetch()` podąża za przekierowaniem po cichu, więc redirect na chronionym API dociera do
  wywołującego jako `200` ze stroną logowania i odrzucony zapis wygląda na udany.

Dodając nową trasę produktową, dopisz ją do właściwej listy — polityka nie jest domyślnie
odmawiająca. Zachowanie bramki jest przypięte testami: `src/lib/route-access.test.ts`
i `e2e/auth-gate.spec.ts`.

Dane są izolowane per konto dwutorowo: każde zapytanie serwisowe filtruje po `user_id`,
a polityki RLS w `supabase/migrations/` egzekwują to samo po stronie bazy.

## Deployment

Aplikacja deployuje się na [Cloudflare Workers](https://workers.cloudflare.com/).

1. Zbuduj projekt:

```bash
npm run build
```

2. Wdróż przez Wrangler:

```bash
npx wrangler deploy
```

Sekrety z tabeli powyżej ustaw w panelu Cloudflare albo przez `npx wrangler secret put`.
Rate limit generowania korzysta z przestrzeni KV o bindingu `AI_RATE_LIMIT` — utwórz ją
(`npx wrangler kv namespace create AI_RATE_LIMIT`) i wstaw `id` oraz `preview_id` do
`wrangler.jsonc`, inaczej generowanie jest odrzucane (limiter jest fail-closed).

## Documentation

Projekt jest budowany z pisemnej podstawy w katalogu `context/` (workflow 10x) — to ona,
nie kod, jest źródłem prawdy o zakresie:

| Plik | Co zawiera |
| --- | --- |
| [`context/foundation/prd.md`](context/foundation/prd.md) | Wizja, persona, kryteria sukcesu, guardraile, FR-001…FR-012, non-goals |
| [`context/foundation/shape-notes.md`](context/foundation/shape-notes.md) | Notatki z fazy kształtowania pomysłu |
| [`context/foundation/roadmap.md`](context/foundation/roadmap.md) | Kolejność pionowych plastrów (F-01 → S-04) |
| [`context/foundation/test-plan.md`](context/foundation/test-plan.md) | Mapa ryzyk R1–R6 i fazy rolloutu testów |
| [`context/foundation/tech-stack.md`](context/foundation/tech-stack.md) | Wybór stacku i uzasadnienie |
| [`context/foundation/infrastructure.md`](context/foundation/infrastructure.md) | Wybór platformy wdrożeniowej i rejestr ryzyk |
| [`context/changes/`](context/changes/) | Plan i przebieg każdej zrealizowanej zmiany |

Dokumentacja API (OpenAPI + Scalar) jest serwowana przez samą aplikację pod `/docs/api`.

## CI

GitHub Actions runs two jobs on every push and PR to `master`:

- **quality** — lint, `astro check`, the unit suite with coverage thresholds, then build.
- **e2e** — the logged-out Playwright project against a freshly started dev server.

Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets. To turn on the
authenticated E2E project, add `E2E_EMAIL` / `E2E_PASSWORD` secrets for a dedicated test
account and append `--project=chromium` to the e2e step.

## License

MIT
