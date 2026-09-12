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
│  Client components  → interactivity, live analytics, realtime   │
│  Route handlers     → /api/contact (validate → insert → email)  │
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
│  Realtime         → live analytics feed                          │
│  Database Webhook → POST /api/revalidate on content change       │
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
a Supabase Database Webhook hits `/api/revalidate` when a row changes, so an edit is
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
await supabase.from('analytics').insert({
  event: 'project_view',
  path: `/projects/${project.slug}`,
  session_id: getSessionId(),
  meta: { project_id: project.id }
});
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
│   │   ├── api/revalidate/    # database webhook → expire the changed table's cache tag
│   │   ├── sitemap.ts, robots.ts, error.tsx, not-found.tsx
│   ├── proxy.ts               # per-request CSP nonce
│   ├── views/                 # The page bodies (client components, data via props)
│   ├── components/            # Pure UI; data arrives as typed props
│   ├── hooks/                 # useSiteContent (context), useRealtimeEvents, useFocusTrap, ...
│   ├── lib/
│   │   ├── supabase/server.ts # per-request client whose fetch is cached + tagged by table
│   │   ├── content.ts         # server reads, deduplicated per request
│   │   ├── contact.ts         # the contact write path as testable functions
│   │   ├── csp.ts             # the policy as a pure function
│   │   └── ogCard.tsx         # the share card (next/og)
│   ├── services/
│   │   ├── supabaseClient.ts  # the browser client (analytics, realtime only)
│   │   ├── api.ts             # one function per query, client injected, deterministic ORDER BY
│   │   ├── queries.ts         # TanStack factories for the reads that stay in the browser
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
REVALIDATE_SECRET=...           # shared secret for the database webhook
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

Connect the repo; `vercel.json` pins the framework to Next.js. Set these in the
project's environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | PostgREST origin (also allow-listed in the CSP) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | public read key; RLS is the boundary |
| `REVALIDATE_SECRET` | yes | bearer token the database webhook sends to `/api/revalidate` |
| `RESEND_API_KEY` | for email | contact-form notifications |
| `SUPABASE_SERVICE_ROLE_KEY` | recommended | lets `/api/contact` insert without an anon INSERT policy |
| `RESEND_FROM`, `CONTACT_NOTIFY_TO` | optional | sender identity; defaults to `onboarding@resend.dev` and `profiles.email` |
| `NEXT_PUBLIC_SITE_URL` | optional | canonical origin for sitemap/OG when not the Vercel production URL |

### Content updates without a deploy

Reads are cached for an hour and tagged by table. To make edits live immediately,
add one **Database Webhook** in the Supabase dashboard (Database → Webhooks):

- Events: `INSERT`, `UPDATE`, `DELETE` on `projects`, `project_sections`,
  `project_storytelling`, `site_content`, `profiles`, `skills`, `experience`,
  `achievements`, `external_profiles`, `resume`
- Type: HTTP request, `POST https://<your-domain>/api/revalidate`
- Header: `Authorization: Bearer <REVALIDATE_SECRET>`

The handler reads `table` from the standard payload and expires that table's tag.

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
| Public read | RLS policy: `status = 'published'` only |
| Contact form | `POST /api/contact`: server-side validation + tag stripping, real IP recorded, DB trigger rate-limits to 3/address/day (reported as 429) |
| Analytics | DB trigger silently drops if session exceeds 100 events/hour |
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
- [ ] Move analytics writes behind `/api/track`, then drop anonymous INSERT from RLS

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