<div align="center">

```
██████╗  ██████╗ ██████╗ ████████╗███████╗ ██████╗ ██╗     ██╗ ██████╗
██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██║     ██║██╔═══██╗
██████╔╝██║   ██║██████╔╝   ██║   █████╗  ██║   ██║██║     ██║██║   ██║
██╔═══╝ ██║   ██║██╔══██╗   ██║   ██╔══╝  ██║   ██║██║     ██║██║   ██║
██║     ╚██████╔╝██║  ██║   ██║   ██║     ╚██████╔╝███████╗██║╚██████╔╝
╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚══════╝╚═╝ ╚═════╝
```

**Backend-Driven Portfolio System**

*A backend-first portfolio where the database is the single source of truth.*
*The frontend renders. The backend decides everything else.*

[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-0F172A?style=flat-square&logo=tailwindcss&logoColor=38BDF8)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)

[Live Demo](https://backend-driven-portfolio.vercel.app) · [Database workflow](./supabase/README.md) · [Report Bug](https://github.com/D-KAMALKALYAN/backend-driven-portfolio/issues)

</div>

---

## The Problem with Traditional Portfolios

Every project update = a code change + a redeployment.
Most portfolios are static documents pretending to be applications.

This one is different.

```
Traditional Portfolio          This System
─────────────────────          ────────────────────────────────
Edit JSX to add project   →    INSERT INTO projects (...)
Redeploy to update bio    →    UPDATE site_content SET value = ...
Hardcoded skill list      →    UPDATE skills SET proficiency = ...
No usage data             →    SELECT * FROM analytics WHERE event = 'project_view'
Manual resume links       →    Upload to bucket → trigger handles the rest
```

**Zero frontend changes for any content update.** That's the contract this system keeps.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  NEXT.JS (App Router, React 19, Tailwind)  ·  on Vercel          │
│                                                                  │
│  Server components  → read content on the server; the HTML      │
│                       arrives with the content in it             │
│  Client components  → interactivity; no database client         │
│  Route handlers     → /api/contact (validate → insert → email)  │
│                       /api/track, /api/analytics, /api/health    │
│                       /api/revalidate (database webhook target)  │
│  proxy.ts           → per-request CSP nonce ('strict-dynamic')  │
│  opengraph-image    → share cards drawn from the same rows       │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ anon key + RLS (reads,        │ service role (writes,
                │ cached + tagged by table)     │ server only)
┌───────────────▼──────────────────────────────▼───────────────────┐
│  SUPABASE                                                        │
│                                                                  │
│  PostgREST        → auto-generated REST from schema              │
│  Row Level Security → public read, no anonymous write (target)  │
│  Storage          → resumes (public bucket, trigger-indexed)     │
│  Realtime         → live analytics feed (the browser's one       │
│                     direct connection, over wss)                 │
│  pg_net triggers  → POST /api/revalidate on content change       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL                                              │   │
│  │  projects          project_sections    project_storytelling │
│  │  experience        achievements        profiles         │   │
│  │  contact_messages  analytics           resume           │   │
│  │  site_content      external_profiles   feature_flags    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Rendering.** Every page is rendered on the server per request, so crawlers and
link unfurlers see real HTML with real `<title>`, description and a per-URL
OpenGraph image. Content reads are cached in Next's Data Cache and tagged by table;
a trigger on every content table hits `/api/revalidate` when a row changes, so an edit is
live on the next request without a deploy. Per-request rendering is the price of a
nonce-based Content-Security-Policy - see `developer-notes/decisions.md` ADR-032 for
why that trade was made over static generation.

---

## Key Features

### 🏛️ Backend-Driven Content
Every string, every section, every config value lives in the database. The `site_content` table acts as a CMS — edit your hero headline, about paragraph, or footer copy directly from SQL or an admin panel. No redeploy.

### 📦 Flexible Project Sections
Projects aren't just titles and descriptions. Each project has typed content blocks — `text`, `image`, `code`, `metrics`, `gallery` — stored as structured JSONB. Add a new section type without touching the schema.

### 📊 Built-in Analytics Engine
Every page view, project click, and resume download is tracked in the `analytics` table. A database trigger auto-increments `projects.view_count` on each event. Top projects get a `🔥 Most Popular` badge, refreshed daily.

### 🔐 Row Level Security at Every Layer
RLS is enabled on all 12 tables. Public visitors can only read published content. Writes are restricted to validated inputs or authenticated admins. The database enforces this — not the application.

### 📄 Resume Versioning
Upload a new PDF to the `resumes` storage bucket → a database trigger automatically inserts a record, deactivates the previous version, and builds the public URL. The download button always serves the latest version.

### 🚩 Feature Flags
Toggle entire sections of the portfolio (blog, hire-me CTA, maintenance mode) by flipping a boolean in the `feature_flags` table. No code changes, no deploys.

---

## Database Schema

| Table | Purpose |
|---|---|
| `projects` | Portfolio projects with slug, status, tech stack, view count |
| `project_sections` | Typed content blocks per project (text/image/code/metrics) |
| `skills` | Categorized skills with proficiency and featured flag |
| `experience` | Work history with highlights and tech used |
| `achievements` | Certifications, awards, publications |
| `profiles` | Personal info, social links, avatar |
| `contact_messages` | Inbound contact form submissions with status tracking |
| `analytics` | Event stream — page views, clicks, downloads |
| `resume` | Version history of uploaded resume PDFs |
| `site_content` | CMS key-value store for all editable copy |
| `activity_logs` | Admin audit trail for all write operations |
| `feature_flags` | Boolean toggles for site features |

All tables use UUID primary keys, `created_at` / `updated_at` timestamps, and a `meta JSONB` column for future extensibility without migrations.

---

## Data Flow Examples

**Fetch published projects with sections:**
```typescript
const { data } = await supabase
  .from('projects')
  .select(`*, project_sections(id, type, title, content, sort_order)`)
  .eq('status', 'published')
  .order('view_count', { ascending: false });
```

**Track a project view (triggers view_count increment automatically):**
```typescript
// The browser never writes to the database. trackEvent() posts to /api/track,
// which computes the idempotency key, records the real IP and inserts with
// the service role; a Postgres trigger increments projects.view_count.
trackEvent('project_view', { project_id: project.id });
```

**Read CMS content as a flat map:**
```typescript
const { data } = await supabase
  .from('site_content')
  .select('key, value')
  .eq('is_public', true);

const content = Object.fromEntries(data.map(r => [r.key, r.value]));
// content['hero.headline'] → "Hi, I'm Kamal."
```

---

## Project Structure

```
.
├── public/
│   └── og-image.png           # 1200x630 share image (seo.og_image points here)
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # fonts, theme bootstrap (nonced), providers, shell
│   │   ├── page.tsx …         # one thin server file per route: fetch → <View />
│   │   ├── projects/[slug]/   # page + generateMetadata + opengraph-image
│   │   ├── api/contact/       # validate → insert (real IP) → Resend notification
│   │   ├── api/revalidate/    # content-table triggers → expire the changed table's cache tag
│   │   ├── sitemap.ts, robots.ts, error.tsx, not-found.tsx
│   ├── proxy.ts               # per-request CSP nonce
│   ├── views/                 # The page bodies (client components, data via props)
│   ├── components/            # Pure UI; data arrives as typed props
│   │   └── Icon.tsx           # lucide icons by name, for the places an icon name is data
│   ├── hooks/                 # useSiteContent (context), useRealtimeEvents, useFocusTrap, ...
│   ├── lib/
│   │   ├── supabase/server.ts # per-request client whose fetch is cached + tagged by table
│   │   ├── content.ts         # server reads, deduplicated per request
│   │   ├── contact.ts         # the contact write path as testable functions
│   │   ├── csp.ts             # the policy as a pure function
│   │   ├── palette.ts         # named hues; hueStyle() sets --c, the .hue-* classes derive tints
│   │   └── ogCard.tsx         # the share card (next/og)
│   ├── services/
│   │   ├── supabaseConfig.ts  # the public URL + anon key, read once; realtime endpoint
│   │   ├── api.ts             # one function per query, client injected, deterministic ORDER BY
│   │   ├── queries.ts         # TanStack factory for the one browser read: GET /api/analytics
│   │   └── analytics.ts       # trackEvent() with idempotency key
│   ├── types/
│   │   ├── database.ts        # GENERATED by `npm run db:types` - never edit by hand
│   │   └── rows.ts            # Readable aliases: Project, Experience, SiteContent, ...
│   ├── utils/                 # Pure, unit-tested: career, popularity, projectFilter, json, ...
│   ├── constants/             # routes, command palette entries
│   └── __tests__/             # vitest (jsdom)
├── supabase/
│   ├── migrations/            # Baseline pulled from production + every change since
│   ├── migrations-archive/    # Pre-baseline hand-written migrations, kept for the reasoning
│   └── README.md              # Database workflow and testing rules
├── .github/workflows/ci.yml   # lint -> typecheck -> test -> build
├── next.config.ts             # static security headers, image origins
├── tsconfig.json              # strict, noUncheckedIndexedAccess
└── README.md
```

**Type safety at the data boundary.** `src/types/database.ts` is generated from the
live schema and the Supabase client is instantiated with it, so `supabase.from('x')`
only accepts real tables and each row comes back with its real columns. Reading a
column that does not exist is a compile error, not a `null` that renders as an empty
section - which is how five earlier bugs in this codebase presented. The one blind
spot is `jsonb` columns: their contents are narrowed at the point of reading through
`src/utils/json.ts`, not trusted.

---

## Local Setup

### Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)

### 1. Clone and install

```bash
git clone https://github.com/D-KAMALKALYAN/backend-driven-portfolio
cd portfolio
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

```env
# .env  (see .env.example for the full list)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Server only
SUPABASE_SERVICE_ROLE_KEY=...   # /api/contact writes with it when present
RESEND_API_KEY=re_...           # contact notifications
REVALIDATE_SECRET=...           # shared secret the revalidate triggers send (also in Vault)
```

> Only `NEXT_PUBLIC_*` names reach the browser bundle. The service-role key and the
> Resend key are read in route handlers only; `import 'server-only'` in those modules
> makes an accidental client import a build error.

### 3. Apply database schema

Run the contents of `supabase/migrations/001_initial_schema.sql` in your Supabase **SQL Editor**, or use the CLI:

```bash
supabase db push
```

### 4. Seed initial content

```bash
# Optional: seed feature flags and site_content defaults
supabase db reset --db-url your_db_url
```

### 5. Start dev server

```bash
npm run dev
```

---

## Deployment

### Vercel

Connect the repo; `vercel.json` pins the framework to Next.js and puts the functions
in **`hnd1` (Tokyo)**, the region of the Supabase project (`ap-northeast-1`). Every
server-side read - page renders on a cache miss, `/api/analytics`, `/api/search`, the
health ping - is a round trip to the database, and from Vercel's default `iad1` that
trip measured 250-800 ms; next to the database it is tens of milliseconds. If the
database ever moves, move this line with it. Set these in the project's environment
variables:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | PostgREST origin (also allow-listed in the CSP) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | public read key; RLS is the boundary |
| `REVALIDATE_SECRET` | yes | bearer token the content-table triggers send to `/api/revalidate`; the same value goes into Vault as `revalidate_secret` |
| `RESEND_API_KEY` | for email | contact-form notifications |
| `SUPABASE_SERVICE_ROLE_KEY` | recommended | lets `/api/contact` insert without an anon INSERT policy |
| `RESEND_FROM`, `CONTACT_NOTIFY_TO` | optional | sender identity; defaults to `onboarding@resend.dev` and `profiles.email` |
| `NEXT_PUBLIC_SITE_URL` | optional | canonical origin for sitemap/OG when not the Vercel production URL |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | error reporting (errors only, tunnelled through `/monitoring`); no-op when absent |
| `OPENAI_API_KEY` | for Ask | server-only key for `POST /api/ask`; the palette's Ask row appears only when set |
| `ASK_MONTHLY_CAP_CENTS` | optional | the app's own monthly cap for Ask, default `300` |
| `ASK_MODEL` / `ASK_MODEL_PRICE` | optional | `gpt-5-mini` (default), `gpt-5`, `gpt-5-nano`, `gpt-4.1-mini`; another model only with its price `input,cached,output` in USD/MTok |
| `CRON_SECRET` | for retention | Vercel attaches it to the daily `/api/cron/rollup` call that rolls analytics older than 90 days into `analytics_daily`; the route refuses without it |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | optional | source-map upload at build time for readable stack traces |

### Sections without a deploy

Two tiers (ADR-036). **Domain tables** hold the content: `now_entries` ("Currently
building/learning/..."), `ventures` (yours, and startups you endorse - the
`relationship` column keeps the two apart). The **`page_sections` registry** says
which sections a page shows, in what order, with what heading:

| page | section_type | what it renders |
|---|---|---|
| `landing` | `now` | `now_entries` where `is_active`; hides itself after 60 days without an update |
| `landing` | `ventures` | `ventures` with `relationship` in founder / co-founder / early-employee / advisor |
| `about` | `explore` | the secondary navigation as cards (Skills, Experience, Profiles, Resume) - the bar holds five items at most |
| `about` | `timeline` | roles + projects + credentials merged into one chronology, newest first - derived, no table |
| `about` | `endorsements` | `ventures` with `relationship = 'endorsement'`, framed as someone else's work |
| `how_it_works` | `prose`, `diagram`, `steps`, `table` | content-only blocks rendered from the row's `config` - the [architecture write-up](https://backend-driven-portfolio.vercel.app/how-it-works) is eight of these |

**Writing** uses the same blocks: a `posts` row is the head, `post_blocks` rows (`prose`,
`code`, `diagram`, `steps`, `table`) are the body. Set `status = 'published'` and the post,
its share card, its sitemap entry and the **Writing** nav item appear; until then the
route is a 404 and the nav item is not rendered. A future `published_at` schedules it.

Adding a row, reordering, retiring (`is_visible = false`) - no deploy. A section with
no rows renders nothing. Adding a new *type* is one component plus one line in
`src/lib/sections.tsx`.

### Search

`Ctrl/⌘ K` searches content, not just commands: one SQL function, `search_content()`,
runs Postgres full-text search over projects, posts (including their body blocks),
skills and experience, weighted and ranked. It runs as the caller, so RLS decides what
is searchable - a draft post cannot be found. Exposed as `GET /api/search?q=`.

### Ask this site (grounded Q&A)

Type a question into the command palette (`Ctrl+K`) - "how is content cached here?" -
and the first row is **Ask**. Enter posts it to `POST /api/ask`, which answers from
the site's own database content with numbered citations that link to the project, note
or page they came from. Nothing else is consulted, and the model is told to say so when
the sources do not cover a question.

How it is kept honest and cheap:

- **Retrieval runs as the anon role.** `ask_context()` is `SECURITY INVOKER` over the
  same full-text search the palette uses; Row Level Security decides what can be quoted.
  A draft post cannot be cited by anyone who could not read it.
- **Every question is a ledger row** (`ask_log`: salted hash of the address, question,
  tokens, cost in micro-dollars). `ask_begin()` is the gate: identical questions within
  seven days are answered from the ledger for free; past **10 questions/hour/address**
  or past the **monthly cap** (`ASK_MONTHLY_CAP_CENTS`, default 300) it refuses with a
  plain message. The browser never touches the table; the functions are service-role only.
- **Cost is what was billed, not estimated**: `ask_finish()` records the response's usage
  at first-party rates, cache reads and writes included. `GET /api/health` shows the
  month's spend and count under `ask`.
- The model is OpenAI's `gpt-5-mini` by default through the Responses API (`ASK_MODEL`
  may name `gpt-5`, `gpt-5-nano` or `gpt-4.1-mini`; any other model needs its price in
  `ASK_MODEL_PRICE` as `input,cached,output` USD per MTok, or it is not run - an unknown
  price is an unknown bill). Reasoning effort `low`; `max_output_tokens` 700. A typical
  question is 2-3k input tokens and costs about **0.1 cent**.

Type `/ask <question>` to force the row for any wording. Env: `OPENAI_API_KEY` (server
only), optional `ASK_MODEL`, `ASK_MODEL_PRICE`, `ASK_MONTHLY_CAP_CENTS`, `ASK_IP_SALT`.
Without the key the Ask row does not appear and the route answers 503. Set a hard usage
limit in the OpenAI dashboard too - the app's cap is the soft one.

### Content updates without a deploy

Reads are cached for an hour and tagged by table. An edit becomes live on the next
request because every content table carries a statement-level trigger
(`supabase/migrations/20260918090000_revalidate_triggers.sql`) that POSTs the standard
webhook payload to `/api/revalidate` through `pg_net`. The secret never touches the
repo: the trigger reads it from Supabase Vault at call time. Set it once, in the SQL
editor:

```sql
select vault.create_secret('<REVALIDATE_SECRET>', 'revalidate_secret');
-- optional: point at a preview or local server instead of production
select vault.create_secret('https://<your-domain>/api/revalidate', 'revalidate_url');
```

Until the secret exists the trigger logs a warning and the edit simply waits for the
hourly refresh; a write is never blocked by the notification. `GET /api/health` reports
whether the chain delivers - `revalidation: { secretSet, triggers, last: { status, at,
error } }` - read through a service-role-only SQL function, so the answer is a boolean
and a status code, never a value. The handler reads `table`
from the payload and expires that table's tag. (The dashboard's "Database Webhooks"
feature is the same mechanism configured by hand, one table at a time; the migration
retires any it finds.)

### Keep Free Tier Active

Add this GitHub Action to prevent Supabase pausing your project after 1 week of inactivity:

```yaml
# .github/workflows/keep-alive.yml
name: Keep Supabase Alive
on:
  schedule:
    - cron: '0 12 */3 * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -s "${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/feature_flags?select=key" \
          -H "apikey: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" > /dev/null
```

---

## Security Model

| Layer | Mechanism |
|---|---|
| Public read | RLS: anon can `SELECT` published content; **no anon `INSERT` policy exists on any table** |
| Contact form | `POST /api/contact`: server-side validation + tag stripping, real IP recorded, DB triggers rate-limit to 3/email/day and 10/IP/day (reported as 429) |
| Analytics | `POST /api/track`: events allow-listed, ids validated, IP + country recorded server-side, idempotency key server-computed; DB trigger silently drops past 100 events/session/hour or 600/IP/hour; raw rows kept 90 days then rolled up daily |
| Admin writes | `is_admin()` function checks JWT email claim |
| Server-side ops | `service_role` key read only in route handlers (`server-only` modules) |
| Scripts | Content-Security-Policy with a per-request nonce and `'strict-dynamic'`; no `unsafe-inline` for scripts |
| Resume access | Public storage bucket; the active row is resolved server-side and the URL built by the SDK |
| SQL injection | Supabase JS client uses parameterized queries — not possible via SDK |

---

## Roadmap

- [ ] Admin dashboard (React + service_role, separate deployment)
- [x] Real-time analytics view (Supabase Realtime subscription)
- [ ] AI portfolio assistant (RAG over project descriptions)
- [ ] Multi-language support via `site_content` locale keys
- [ ] GitHub activity auto-sync (Edge Function + cron)
- [x] OpenGraph image generation per project (`next/og`)
- [x] Move analytics writes behind `/api/track`; drop anonymous INSERT from RLS once the service key is configured

---

## Philosophy

> **Build systems, not pages.**

Most portfolios are frozen snapshots — accurate on launch day, stale within a month. This system treats the portfolio as a living product: the schema is the contract, the database is the content layer, and the frontend is just one possible consumer of that data.

The same Supabase backend could power a mobile app, a CLI tool, or a different frontend framework without touching a single line of application logic. That's the point.

---

## Author

**Kamal Kalyan**
Backend-focused engineer specializing in system design, security, and scalable architectures.

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github)](https://github.com/your-username)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/your-profile)

---

<div align="center">

*If this architecture helped you think differently about how portfolios can be built — that's the whole point.*

</div>