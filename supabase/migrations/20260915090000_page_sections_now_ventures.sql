-- ============================================================
-- page_sections_now_ventures
--
-- The user's original ask: "currently working on", "endorse my startup",
-- "other interesting sections - a one-stop solution". Three requests with
-- one shape: adding a section. If each one is a new page component and a
-- deploy, the project's own thesis fails; if it is a JSON layout engine, the
-- portfolio becomes a CMS with one user. The line drawn in
-- developer-notes/v2-content-sections.md and ADR-036:
--
--   Tier 1  domain tables    now_entries, ventures (+ the existing ones)
--                            adding a ROW = no deploy
--   Tier 2  page_sections    which sections appear on which page, in what
--                            order, with what heading
--                            adding an INSTANCE = no deploy
--                            adding a TYPE = one component + one enum value
--
-- Reads are anon (RLS: visible rows only). No INSERT policy on any of them -
-- writes are the owner's, through the dashboard or the service role
-- (ADR-033). updated_at is maintained by the existing trigger function.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. now_entries - "currently ..."
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.now_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('building', 'learning', 'reading', 'exploring', 'writing')),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 600),
  -- Optional: "building X" links straight to X's project page.
  project_id  UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  url         TEXT,
  progress    TEXT CHECK (progress IS NULL OR char_length(progress) <= 60),   -- "week 3", "MVP done"
  started_on  DATE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_now_active ON public.now_entries (is_active, sort_order);

ALTER TABLE public.now_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active now entries" ON public.now_entries;
CREATE POLICY "Public can read active now entries" ON public.now_entries
  FOR SELECT TO anon, authenticated USING (is_active);

DROP TRIGGER IF EXISTS trg_update_now_entries_updated_at ON public.now_entries;
CREATE TRIGGER trg_update_now_entries_updated_at
  BEFORE UPDATE ON public.now_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ------------------------------------------------------------
-- 2. ventures - startups: yours, and the ones you vouch for
-- ------------------------------------------------------------
-- A startup is not a project: different lifecycle, different relationship,
-- different proof. `relationship` is the column that matters - what you
-- built and what you are recommending must never render as the same thing.
CREATE TABLE IF NOT EXISTS public.ventures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  tagline         TEXT CHECK (tagline IS NULL OR char_length(tagline) <= 160),
  description     TEXT CHECK (description IS NULL OR char_length(description) <= 1200),
  website_url     TEXT,
  logo_url        TEXT,
  relationship    TEXT NOT NULL CHECK (relationship IN ('founder', 'co-founder', 'early-employee', 'advisor', 'endorsement')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('stealth', 'active', 'acquired', 'wound-down')),
  role            TEXT CHECK (role IS NULL OR char_length(role) <= 80),
  founded_on      DATE,
  ended_on        DATE,
  industry        TEXT[] NOT NULL DEFAULT '{}',
  tech_stack      TEXT[] NOT NULL DEFAULT '{}',
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Friends' startups die. Something to sort a periodic link check by.
  link_checked_at TIMESTAMPTZ,
  meta            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT venture_dates CHECK (ended_on IS NULL OR founded_on IS NULL OR ended_on >= founded_on)
);

CREATE INDEX IF NOT EXISTS idx_ventures_visible ON public.ventures (is_visible, sort_order);

ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read visible ventures" ON public.ventures;
CREATE POLICY "Public can read visible ventures" ON public.ventures
  FOR SELECT TO anon, authenticated USING (is_visible);

DROP TRIGGER IF EXISTS trg_update_ventures_updated_at ON public.ventures;
CREATE TRIGGER trg_update_ventures_updated_at
  BEFORE UPDATE ON public.ventures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ------------------------------------------------------------
-- 3. page_sections - the registry
-- ------------------------------------------------------------
-- `section_type` is deliberately NOT a CHECK enum here: the set of types is
-- what the code can render, and the code is where it is enforced
-- (src/lib/sections.ts). A row with an unknown type renders nothing and is
-- reported, rather than failing an INSERT that a future deploy will honour.
CREATE TABLE IF NOT EXISTS public.page_sections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page         TEXT NOT NULL CHECK (page IN ('landing', 'about')),
  section_type TEXT NOT NULL CHECK (section_type ~ '^[a-z_]+$'),
  heading      TEXT CHECK (heading IS NULL OR char_length(heading) <= 80),
  description  TEXT CHECK (description IS NULL OR char_length(description) <= 300),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  config       JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page, section_type)
);

CREATE INDEX IF NOT EXISTS idx_page_sections_page ON public.page_sections (page, is_visible, sort_order);

ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read visible page sections" ON public.page_sections;
CREATE POLICY "Public can read visible page sections" ON public.page_sections
  FOR SELECT TO anon, authenticated USING (is_visible);

DROP TRIGGER IF EXISTS trg_update_page_sections_updated_at ON public.page_sections;
CREATE TRIGGER trg_update_page_sections_updated_at
  BEFORE UPDATE ON public.page_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ------------------------------------------------------------
-- 4. Seed: the registry rows, and the one "now" entry that is verifiably true
-- ------------------------------------------------------------
-- Rule from v2-content-sections.md §6: do not ship a section without real
-- content. The sections below hide themselves when their table is empty, so
-- registering `ventures` and `endorsements` now costs nothing and means the
-- first venture row appears without a deploy.
INSERT INTO public.page_sections (page, section_type, heading, description, sort_order, is_visible)
VALUES
  ('landing', 'now',          'Currently',          'What I am building, learning and exploring right now.', 10, TRUE),
  ('landing', 'ventures',     'Ventures',           NULL,                                                    20, TRUE),
  ('about',   'endorsements', 'Building alongside', 'Founders and products I would vouch for - not my work, but worth your attention.', 10, TRUE)
ON CONFLICT (page, section_type) DO NOTHING;

-- The portfolio itself: the one thing this author is demonstrably building
-- right now (commit history is the evidence). Linked to its own project row.
INSERT INTO public.now_entries (kind, title, description, project_id, progress, started_on, sort_order)
SELECT
  'building',
  'This portfolio, v2',
  'Moving a Vite SPA to Next.js with server-rendered pages, a nonce-based CSP, server-side writes and error reporting - every change recorded as an ADR.',
  p.id,
  'audit closed, roadmap P3 next',
  DATE '2026-08-30',
  0
FROM public.projects p
WHERE p.slug = 'elite-backend-driven-portfolio'
  AND NOT EXISTS (SELECT 1 FROM public.now_entries WHERE title = 'This portfolio, v2');


-- ------------------------------------------------------------
-- POST-CHECK (as anon)
-- ------------------------------------------------------------
--   SET ROLE anon;
--   SELECT page, section_type, is_visible FROM page_sections ORDER BY page, sort_order;  -- 3 rows
--   SELECT kind, title FROM now_entries;                                                  -- 1 row
--   INSERT INTO now_entries (kind, title) VALUES ('learning', 'x');                       -- refused (42501)
--   RESET ROLE;
--   UPDATE page_sections SET is_visible = FALSE WHERE section_type = 'ventures';
--   SET ROLE anon; SELECT count(*) FROM page_sections;                                    -- 2
