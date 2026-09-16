-- ============================================================
-- how_it_works_page
--
-- Roadmap 3.4: "How this site works" - the page that turns the project into
-- an interview artifact. It is not a component per paragraph: it is
-- page_sections rows with page = 'how_it_works', rendered by the registry
-- (ADR-036) through four content-only types added for it - prose, diagram,
-- steps, table. Editing the explanation is editing a row. The same four
-- types are what a writing section will use.
--
-- Every claim below describes something built and verified in the ADRs
-- (developer-notes/decisions.md). Numbers are avoided where they would go
-- stale; behaviour is described instead.
--
-- Also: the footer's backend-driven note gains a link to the page, and the
-- footer navigation JSON gains an entry, so the page is reachable without a
-- ninth item in the main nav.
--
-- SAFE TO RE-RUN.
-- ============================================================

-- The registry's page CHECK was ('landing','about'); this is the third page.
ALTER TABLE public.page_sections DROP CONSTRAINT IF EXISTS page_sections_page_check;
ALTER TABLE public.page_sections
  ADD CONSTRAINT page_sections_page_check CHECK (page IN ('landing', 'about', 'how_it_works'));

-- The (page, section_type) uniqueness that made sense for landing/about
-- would forbid two prose blocks on one page. Relax it to (page, sort_order)
-- so a page can have several blocks of one type, ordered.
ALTER TABLE public.page_sections DROP CONSTRAINT IF EXISTS page_sections_page_section_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS page_sections_page_sort_key ON public.page_sections (page, sort_order);

INSERT INTO public.page_sections (page, section_type, heading, description, sort_order, is_visible, config)
VALUES
-- ------------------------------------------------------------ 1
('how_it_works', 'prose', 'The idea', NULL, 10, TRUE, jsonb_build_object(
  'paragraphs', jsonb_build_array(
    'Most portfolios are a static page that is accurate on launch day and stale within a month. This one treats the portfolio as a product: the database is the single source of truth, the frontend is one consumer of it, and changing what the site says - a project, a role, a section, a heading - is a row edit, not a deploy.',
    'That thesis was tested by an audit of the first version and found wanting in places: navigation and SEO were hardcoded while the rows meant to drive them sat unread, a resume workflow was broken because code queried a table that did not exist, and the browser could write to the database with a public key. This page describes the system after that audit, and the decisions it forced.'
  ),
  'link', jsonb_build_object('href', '/projects/elite-backend-driven-portfolio', 'label', 'The project page, with its case study')
)),

-- ------------------------------------------------------------ 2
('how_it_works', 'diagram', 'What runs where', 'One request, end to end.', 20, TRUE, jsonb_build_object(
  'ascii', E'browser ──GET /projects/x──▶ Vercel edge ──▶ proxy.ts        fresh nonce; CSP header\n                                              │\n                                              ▼\n                                     Next.js server render\n                                     ┌───────────────────────────┐\n                                     │ layout: site_content      │  cached, tagged table:site_content\n                                     │ page:   project by slug   │  cached, tagged table:projects\n                                     │         sections, story   │  cached, tagged table:project_sections ...\n                                     └─────────────┬─────────────┘\n                                                   │  Data Cache miss?\n                                                   ▼\n                                        Supabase PostgREST  (anon key)\n                                        Row Level Security decides what is visible\n                                                   │\n                                                   ▼\n                                     HTML with content, <title>, og:image\n                                     every <script> carries the nonce\n◀───────────────────────────────────────────────────┘\n\nwrites never take this path:\n  browser ──POST /api/track, /api/contact──▶ route handler (service role) ──▶ Postgres triggers: rate limits\n  Supabase webhook ──POST /api/revalidate──▶ expire tag table:<name>   (an edit is live on the next request)',
  'caption', 'Reads are direct and cached; writes go through the server. Every page is rendered per request so the CSP nonce is real; the data underneath is cached, so the render is milliseconds.'
)),

-- ------------------------------------------------------------ 3
('how_it_works', 'steps', 'The data model', 'Two tiers, and a rule for which is which.', 30, TRUE, jsonb_build_object(
  'steps', jsonb_build_array(
    jsonb_build_object('title', 'Domain tables hold things with structure', 'body', '`projects`, `experience`, `skills`, `achievements`, `now_entries`, `ventures`. Adding a row is no deploy. Every column is typed in the app from the generated schema, so reading a column that does not exist is a compile error - the class of bug the audit found five times.'),
    jsonb_build_object('title', 'A registry decides what a page shows', 'body', '`page_sections` says which sections appear on which page, in what order, with what heading, visible or not. Adding an instance or reordering is a row. Adding a section *type* is one component and one line of code, because a type without a component is a blank space.'),
    jsonb_build_object('title', 'Blocks inside a page are rows too', 'body', 'A project page is `project_sections` rows typed `text`, `code`, `metrics`, `image`. This page is `page_sections` rows typed `prose`, `diagram`, `steps`, `table`. jsonb carries the content; the app narrows it at the point of reading and renders nothing for a shape it does not recognise.'),
    jsonb_build_object('title', 'Some things stay in code, on purpose', 'body', 'Routes, section types and the hero. A route with no component is a 404, which is a code change. The line is: backend-drive what changes independently of code - copy, ordering, visibility - and keep in code what only changes when the code changes.')
  )
)),

-- ------------------------------------------------------------ 4
('how_it_works', 'prose', 'Security model', NULL, 40, TRUE, jsonb_build_object(
  'paragraphs', jsonb_build_array(
    'The browser holds the public anon key, so Row Level Security is the authorization boundary, not the key. The anon role can read published content and nothing else: there is no INSERT policy on any table. Both writes - analytics events and contact messages - go through route handlers that use the service role, record the real IP and country, validate with the same functions the form uses, and let Postgres triggers enforce the rate limits (per address and, now that the address is real, per IP).',
    'Every page carries a Content-Security-Policy with a per-request nonce and `strict-dynamic`: no `unsafe-inline` for scripts. That is why pages render per request rather than as static files - a nonce baked into a static file is not a nonce. Fonts are self-hosted, error reports leave through this origin, and the trade against edge-cached HTML was made deliberately and measured afterwards.'
  ),
  'bullets', jsonb_build_array(
    'Trigger functions that read a table are `SECURITY DEFINER` with a pinned `search_path`, and are tested as the `anon` role - twice a limit passed as the superuser and did nothing in production, because superusers bypass RLS.',
    'A honeypot field, tag stripping and length caps on the contact route; the visitor sees a generic error, the log sees the Postgres code.',
    'The service-role key is read only in `server-only` modules; importing one from client code is a build error.'
  )
)),

-- ------------------------------------------------------------ 5
('how_it_works', 'steps', 'The analytics pipeline', 'Honest numbers, or none.', 50, TRUE, jsonb_build_object(
  'steps', jsonb_build_array(
    jsonb_build_object('title', 'The browser sends what only it knows', 'body', 'Event, path, referrer and two ids: a per-tab session id and a per-browser visitor id. `fetch` with `keepalive`, so the click that navigates away is not the event that gets lost.'),
    jsonb_build_object('title', 'The server adds what only it knows', 'body', 'IP, country from the edge, and an idempotency key computed from the server clock - so a repeat inside a minute is rejected by a unique index, not by client code being correct. Unknown events and oversized payloads are refused.'),
    jsonb_build_object('title', 'Postgres keeps the counters', 'body', 'A trigger increments a project''s view count on `project_view`; another silently drops a session past its hourly budget. The dashboard reads a view that zero-fills the last 30 days so a quiet day is a zero, not a gap.'),
    jsonb_build_object('title', 'The dashboard tells the truth', 'body', '"Sessions" is labelled sessions because that is what is counted. The realtime badge reports the actual socket state - Live, Snapshot or Connecting - rather than pulsing over data fetched once. A hardcoded "Uptime 99.9%" was removed because nothing measured it.')
  )
)),

-- ------------------------------------------------------------ 6
('how_it_works', 'table', 'Decisions and what they cost', 'The ones an interviewer should ask about.', 60, TRUE, jsonb_build_object(
  'columns', jsonb_build_array('Decision', 'Instead of', 'Why, and the price'),
  'rows', jsonb_build_array(
    jsonb_build_array('Render every page per request with a nonce CSP', 'Static generation + `unsafe-inline` scripts', 'Keeps the strict policy a reviewer can check. Costs edge caching of the HTML; data is cached so the render is milliseconds, and it was measured after deploy rather than assumed.'),
    jsonb_build_array('Reads direct to PostgREST under RLS; writes through the server', 'An API tier for everything', 'An API for reads would re-implement RLS in application code - strictly worse. Writes need a trusted context for secrets, real IPs and structural limits.'),
    jsonb_build_array('Derive "popular" and "in progress" from data', 'A stored flag and a cron that never ran', 'The flag was true on every row and the cron was never created. Top-N by views and `end_date IS NULL` need no scheduler and cannot go stale.'),
    jsonb_build_array('A "Currently" section that hides itself after 60 days', 'A section that stays up', 'A stale "now" signals abandonment on the page whose job is momentum. The heading shows the date; past the window the section returns nothing.'),
    jsonb_build_array('Keep endorsements visually apart from own ventures', 'One list of logos', 'A recruiter assumes you founded everything on the wall. The `relationship` column decides the frame, and a dead link is retired with one boolean.'),
    jsonb_build_array('Generated database types, strict TypeScript', 'Review, and two regex-based guard tests', 'Five production bugs were reads of columns that did not exist. The compiler found four more on the first pass and the guards were deleted.'),
    jsonb_build_array('Error reporting, errors only, through this origin', 'Tracing, replay, a direct ingest domain', 'The signal that matters is "a route threw and nobody knew". The tunnel keeps the CSP unchanged and survives ad blockers; the rest was not worth the bundle.')
  )
)),

-- ------------------------------------------------------------ 7
('how_it_works', 'prose', 'How it is kept true', NULL, 70, TRUE, jsonb_build_object(
  'paragraphs', jsonb_build_array(
    'The schema in the repository is a baseline pulled from production, and every change since is a migration that is replayed into an empty local database before it is pushed. Types are generated from that schema and the client is instantiated with them. Lint, typecheck, tests and a build run on every pull request; the build runs with placeholder credentials and no network, which is the proof that nothing fetches at build time.',
    'Beyond the tests, every change was verified where it matters: in a real browser against the deployed site for anything a visitor sees, and from outside with the public key for anything the database is supposed to refuse. Each significant decision is an architecture decision record, including the two that were wrong the first time and why.'
  ),
  'bullets', jsonb_build_array(
    'Data migrations are guarded (`WHERE EXISTS`, `ON CONFLICT DO UPDATE`) and tested against seeded rows, so replaying from nothing works.',
    'Content edits reach the page through a database webhook that expires exactly the table that changed; without it, within the hour.',
    'The generated types file is never edited by hand - a schema change is a migration, a regeneration, and whatever the compiler then says.'
  )
)),

-- ------------------------------------------------------------ 8
('how_it_works', 'prose', 'What is next', NULL, 80, TRUE, jsonb_build_object(
  'paragraphs', jsonb_build_array(
    'A writing section on the same block model - a few notes on the bugs the audit found would say more than any summary. Semantic search over projects with `pgvector` once there is enough to search. A retention policy for raw analytics. And the honest continuation of the thesis: fewer things in code, more things as rows, without ever building the layout engine that would make this a CMS with one user.'
  )
))
ON CONFLICT (page, sort_order) DO NOTHING;

-- ------------------------------------------------------------
-- Reach the page without a ninth nav item
-- ------------------------------------------------------------
UPDATE public.site_content
SET value_json = COALESCE(value_json, '{}'::jsonb)
  || jsonb_build_object('href', '/how-it-works', 'link_label', 'How it works')
WHERE key = 'footer.backend_note';

UPDATE public.site_content
SET value_json = jsonb_set(
  COALESCE(value_json, '{"links": []}'::jsonb),
  '{links}',
  (COALESCE(value_json -> 'links', '[]'::jsonb)) || jsonb_build_array(jsonb_build_object('label', 'How it works', 'path', '/how-it-works'))
)
WHERE key = 'footer.nav_links'
  AND NOT (COALESCE(value_json -> 'links', '[]'::jsonb) @> '[{"path": "/how-it-works"}]'::jsonb);

-- POST-CHECK
--   SELECT sort_order, section_type, heading FROM page_sections WHERE page = 'how_it_works' ORDER BY sort_order;  -- 8 rows
--   SELECT value_json -> 'href' FROM site_content WHERE key = 'footer.backend_note';                              -- "/how-it-works"
