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
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-0F172A?style=flat-square&logo=tailwindcss&logoColor=38BDF8)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)

[Live Demo](https://your-domain.dev) · [Database Schema](./docs/schema.sql) · [Report Bug](https://github.com/your-username/portfolio/issues)

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
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React + Vite + Tailwind)                            │
│  Pure rendering layer. No hardcoded content. No business logic. │
│                                                                  │
│  Pages        → query Supabase, render what comes back          │
│  Components   → accept data as props, display it                │
│  Hooks        → typed wrappers around supabase-js calls         │
└──────────────────────────┬──────────────────────────────────────┘
                           │  supabase-js (anon key + RLS)
┌──────────────────────────▼──────────────────────────────────────┐
│  SUPABASE                                                        │
│                                                                  │
│  PostgREST API   → auto-generated REST from schema              │
│  Row Level Security → public read, controlled write             │
│  Storage         → resumes (private) + assets (public)          │
│  Realtime        → live analytics, new message notifications    │
│  Edge Functions  → GitHub sync, email notifications, cron jobs  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL                                              │   │
│  │                                                          │   │
│  │  projects          project_sections    skills           │   │
│  │  experience        achievements        profiles         │   │
│  │  contact_messages  analytics           resume           │   │
│  │  site_content      activity_logs       feature_flags    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

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
├── src/
│   ├── components/          # Pure UI components, data via props
│   │   ├── projects/
│   │   ├── sections/        # Renders project_sections by type
│   │   ├── skills/
│   │   └── ui/
│   ├── pages/               # Route-level components
│   │   ├── Home.tsx
│   │   ├── Projects.tsx
│   │   └── Project.tsx      # Dynamic [slug] page
│   ├── hooks/               # Typed Supabase data hooks
│   │   ├── useProjects.ts
│   │   ├── useSiteContent.ts
│   │   └── useFeatureFlags.ts
│   ├── services/            # Supabase client + query functions
│   │   ├── supabase.ts
│   │   ├── analytics.ts
│   │   └── resume.ts
│   ├── types/               # Database type definitions
│   │   └── database.types.ts
│   └── utils/
│       └── formatters.ts
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── sync-github/
│   │   ├── notify-contact/
│   │   └── refresh-badges/
│   └── migrations/          # All schema changes, version controlled
│       └── 001_initial_schema.sql
├── docs/
│   └── schema.sql           # Full schema for reference
├── .env.example
└── README.md
```

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
# .env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

> ⚠️ Never put `SUPABASE_SERVICE_ROLE_KEY` in a Vite `.env` file. It gets bundled into the client. Use it only in Edge Functions or a server-side API layer.

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

### Frontend (Vercel — recommended)

```bash
# Connect your repo to Vercel
# Set environment variables in Vercel dashboard:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Edge Functions

```bash
supabase functions deploy sync-github
supabase functions deploy notify-contact
supabase functions deploy refresh-badges

# Set secrets
supabase secrets set GITHUB_TOKEN=ghp_...
supabase secrets set RESEND_API_KEY=re_...
```

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
          curl -s "${{ secrets.VITE_SUPABASE_URL }}/rest/v1/feature_flags?select=key" \
          -H "apikey: ${{ secrets.VITE_SUPABASE_ANON_KEY }}" > /dev/null
```

---

## Security Model

| Layer | Mechanism |
|---|---|
| Public read | RLS policy: `status = 'published'` only |
| Contact form | RLS `WITH CHECK` validates email format + DB trigger rate-limits to 3/day |
| Analytics | DB trigger silently drops if session exceeds 100 events/hour |
| Admin writes | `is_admin()` function checks JWT email claim |
| Server-side ops | `service_role` key used only in Edge Functions, never in client |
| Resume access | Storage bucket private; signed URLs generated server-side |
| SQL injection | Supabase JS client uses parameterized queries — not possible via SDK |

---

## Roadmap

- [ ] Admin dashboard (React + service_role, separate deployment)
- [ ] Real-time analytics view (Supabase Realtime subscription)
- [ ] AI portfolio assistant (RAG over project descriptions)
- [ ] Multi-language support via `site_content` locale keys
- [ ] GitHub activity auto-sync (Edge Function + cron)
- [ ] OpenGraph image generation per project (Edge Function + Satori)

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