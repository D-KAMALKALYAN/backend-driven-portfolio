-- ============================================================
-- content_population
-- Fixes a content bug and populates three empty or placeholder areas.
--
-- SAFE TO RE-RUN.
--
-- Every piece of prose below is a DRAFT written from the data already in
-- the database (bio, project descriptions, existing sections). It is meant
-- to be edited in the dashboard, not treated as final copy. Nothing here
-- invents facts; where a claim could not be supported by existing content
-- it is phrased as approach rather than outcome.
-- ============================================================


-- ------------------------------------------------------------
-- 1. BUG: two projects' sections are crossed
-- ------------------------------------------------------------
-- The three sections under codeguardian describe Skillverse ("Skillverse is
-- a real-time skill bartering platform...", "Socket.IO for real-time
-- communication..."), and the three under skillverse describe CodeGuardian
-- ("web application security scanner...", "reportXSS()"). Their project_id
-- values are swapped, so each project page has been showing the other's
-- case study.

UPDATE project_sections
SET project_id = 'f54f2982-df5f-4a32-b0ae-49eb0fdf3ad6'   -- skillverse
WHERE id IN (
  '820a5baf-c5e6-4dbc-b01f-ce0282d41477',   -- "Overview": Skillverse is a real-time...
  '7a4f5276-610a-416d-a637-27596423d172',   -- "Architecture": MERN + Socket.IO
  'c771943a-3407-4279-9ee5-fcb63814d061'    -- "Usage": Active Users / Skill Matches
);

UPDATE project_sections
SET project_id = 'eb5fa1b7-6c90-4888-898c-5ff657497012'   -- codeguardian
WHERE id IN (
  '53aec975-f61b-4f85-a552-75a5ec0327c0',   -- "Overview": CodeGuardian is a scanner...
  'f54c4b0a-e964-4896-a056-25b7c6cd4a36',   -- "Detection Logic": reportXSS()
  'd7ea9eb0-063d-4019-b53c-012441417f72'    -- "Security Impact": Vulnerabilities Found
);


-- ------------------------------------------------------------
-- 2. profiles.meta - the About page sections that were never visible
-- ------------------------------------------------------------
-- About.jsx renders Philosophy / Approach / Interests / Education /
-- Certifications, plus a years-experience and focus-area chip, all from
-- meta. It has been {} since the row was created, so none of them have ever
-- rendered. Drafted from the bio; edit freely.

UPDATE profiles
SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
  'focus_area', 'Backend & Application Security',
  'years_experience', 2,
  'philosophy',
    'Systems should be boring to operate and hard to misuse. I would rather '
    'enforce an invariant in the database than remember to check it in every '
    'caller, and I would rather a request fail loudly than succeed with the '
    'wrong data. Most production incidents I have seen were not exotic - they '
    'were a check that lived in the wrong layer.',
  'approach',
    'Measure before changing. I instrument the running system - network '
    'captures, query plans, real browser sessions - before trusting a '
    'code-reading explanation, because the obvious cause is often already '
    'fixed and the real one is somewhere else. Then I move guarantees to the '
    'lowest layer that can hold them: constraints over triggers, RLS over '
    'application checks, generated types over conventions.',
  'interests',
    'Multi-tenant isolation and the request pipelines that enforce it. '
    'Application security - SAST/DAST, the OWASP Top 10, and the gap between '
    'what a codebase claims to validate and what it actually does. Postgres '
    'as an application platform: RLS, JSONB, triggers, and knowing when each '
    'is the wrong tool.',
  'education',
    'Self-directed and project-led. The most instructive work has been '
    'building production-shaped systems end to end - a multi-tenant SaaS core, '
    'a security scanner, and this portfolio, which is itself an exercise in '
    'backend-driven architecture - and then auditing them honestly.',
  'certifications',
    'Microsoft Certified: Azure AI Engineer Associate (2025). Hackathon '
    'participant, Lumen Technologies (2023) - built a scalable event '
    'management system as a team.'
)
WHERE is_active = TRUE;


-- ------------------------------------------------------------
-- 3. seo.og_image - was a literal placeholder
-- ------------------------------------------------------------
-- The value was 'https://your-domain.com/og-image.png'. Any link preview
-- that read it would have shown a broken image. A real 1200x630 image now
-- ships in public/ and is served from the site's own origin.

UPDATE site_content
SET value = 'https://backend-driven-portfolio.vercel.app/og-image.png',
    updated_at = NOW()
WHERE key = 'seo.og_image';


-- ------------------------------------------------------------
-- 4. project_storytelling - built, fetched on every project page, empty
-- ------------------------------------------------------------
-- ProjectDetail.jsx renders five typed sections per project in this order:
-- why_this_project, problem_statement, solution_approach, tradeoffs, impact.
-- The table has had zero rows since it was created.
--
-- Idempotent and safe on any database: this is a DATA migration that
-- references production rows by id, so it must not fail where those rows do
-- not exist (a fresh `db reset`, a preview branch). Rows are upserted on the
-- table's UNIQUE (project_id, section_type) and filtered to projects that
-- actually exist. On an empty database it inserts nothing; on production it
-- inserts or refreshes all 25.

INSERT INTO project_storytelling (project_id, section_type, title, body, sort_order)
SELECT v.project_id::uuid, v.section_type, v.title, v.body, v.sort_order
FROM (VALUES

-- ── SaaS Multi-Tenant Core Platform ──────────────────────────────────────
('c7b4a9d2-4e73-4b0d-a8c5-1f3d8f9a7e11', 'why_this_project', NULL::text,
 'Every SaaS product I looked at rebuilt the same foundation - tenant isolation, authentication for both humans and machines, per-tenant limits, audit trails - and usually got at least one of them subtly wrong. I wanted a core that gets those right once, so a product team can start from the business logic instead of the plumbing.', 1),

('c7b4a9d2-4e73-4b0d-a8c5-1f3d8f9a7e11', 'problem_statement', NULL::text,
 'Shared-schema multi-tenancy is efficient but unforgiving: one missed tenant filter leaks data across customers. Authentication has two different shapes - short-lived JWTs for users, long-lived API keys for integrations - that are usually bolted together. Rate limits, audit logging and schema migrations tend to arrive late, as retrofits, when they are hardest to add.', 2),

('c7b4a9d2-4e73-4b0d-a8c5-1f3d8f9a7e11', 'solution_approach', NULL::text,
 'A layered request pipeline in Spring Boot: authentication, tenant resolution, then request governance, each as a filter with a single responsibility. Tenant identity is resolved once and propagated through a ThreadLocal context that every repository reads, so isolation is enforced at the infrastructure layer rather than remembered per query. Separate paths for JWT and API-key clients. Per-tenant Token Bucket rate limiting with Bucket4j, plan-aware quotas, and Caffeine caching so API-key lookups almost never hit the database. Asynchronous audit logging through Spring AOP. Flyway migrations and structured logging with correlation IDs from day one.', 3),

('c7b4a9d2-4e73-4b0d-a8c5-1f3d8f9a7e11', 'tradeoffs', NULL::text,
 'Shared-schema over schema-per-tenant: cheaper to operate and migrate, at the cost of relying entirely on the tenant filter being correct - which is why it lives in one place. ThreadLocal context is simple and fast but does not cross async boundaries without explicit propagation, so anything that spawns work must carry it deliberately. In-memory rate-limit buckets are fast and evict automatically for inactive tenants, but they are per-instance; a horizontally scaled deployment would need a shared store.', 4),

('c7b4a9d2-4e73-4b0d-a8c5-1f3d8f9a7e11', 'impact', NULL::text,
 'A five-layer pipeline, three tenant plans, and roughly 95% fewer database lookups for API-key authentication thanks to caching. More importantly, the concerns that are usually retrofitted - isolation, limits, audit, migrations - are structural, so a product built on this core inherits them rather than reimplementing them.', 5),

-- ── Backend-Driven Portfolio ──────────────────────────────────────────────
('f9e71425-1211-400a-8875-772557687dfd', 'why_this_project', NULL::text,
 'A portfolio is usually the least engineered thing an engineer ships: hardcoded content, redeployed for every typo. I wanted the opposite - a small production system whose content, configuration and even navigation labels live in a database, so that updating it is a data change rather than a code change. It is also a deliberate exercise in the questions I care about: where authorization should live, what happens when there is no server, and whether a claim like "backend-driven" survives an honest audit.', 1),

('f9e71425-1211-400a-8875-772557687dfd', 'problem_statement', NULL::text,
 'Making a site genuinely backend-driven, not just database-backed. Rendering from a database is easy; the hard part is that the frontend has to know the shape of what it renders, so every field the UI reads is a contract the schema must honour. With no application server, the browser talks to Postgres directly through a public API key, and row-level security becomes the entire authorization boundary - which means every policy has to be right for every client, including curl.', 2),

('f9e71425-1211-400a-8875-772557687dfd', 'solution_approach', NULL::text,
 'React on Vercel talking straight to Supabase via PostgREST. Content tables for projects, experience, skills and achievements; a typed, ordered content-block table for project case studies; a key-value table for site copy and navigation labels. Analytics written fire-and-forget to Postgres with a deterministic idempotency key that a unique index enforces, and aggregated server-side by an RPC and a view so the client does no math. Realtime subscription so the analytics page is actually live. A schema snapshot the test suite validates every query against, until generated types replace it.', 3),

('f9e71425-1211-400a-8875-772557687dfd', 'tradeoffs', NULL::text,
 'No server means no secret can be held, no rate limit can key on a real IP, and no input can be validated in a way a direct API call cannot bypass - so validation lives in Postgres constraints, and the AI and email features need a server route before they can exist. Client-side rendering means the HTML ships empty: fast to build, but invisible to link unfurlers. And backend-driven has a limit: routes and layout stay in code, because a route with no component is a 404, and that is a code change, not content.', 4),

('f9e71425-1211-400a-8875-772557687dfd', 'impact', NULL::text,
 'Content edits require zero deploys. The site runs its own analytics on Postgres with no third-party script. And an honest audit found the original build was about 60% backend-driven - 46% of the configuration rows were read by nothing - which became the roadmap: navigation, headings, 404 copy and SEO now come from the database, and dead keys dropped from 24 to 5.', 5),

-- ── Legacy Code Modernization Assistant ───────────────────────────────────
('90931c06-bb9b-467c-ad34-bd635175477b', 'why_this_project', NULL::text,
 'Most of the code in the world is legacy code, and most of it is under-documented. Understanding it is the bottleneck for every modernisation effort - not the rewrite itself. Large language models are good at exactly the summarise-and-explain task that bottleneck needs, if they are given the right context and asked for structured output.', 1),

('90931c06-bb9b-467c-ad34-bd635175477b', 'problem_statement', NULL::text,
 'Engineers inheriting a legacy system spend most of their time working out what it does before they can change it safely. Documentation is missing or stale, the original authors are gone, and the risk of an unintended behaviour change makes teams reluctant to touch anything. A tool that could read the code and explain its structure, risks and modernisation options would remove the slowest step.', 2),

('90931c06-bb9b-467c-ad34-bd635175477b', 'solution_approach', NULL::text,
 'An assistant that analyses legacy code and produces modernisation recommendations through contextual prompting with structured outputs, so the result is something a team can act on rather than free-form prose. Built on a MERN stack with a Python analysis layer, with a clean architecture that keeps the model integration replaceable and the rest of the system independent of any one provider.', 3),

('90931c06-bb9b-467c-ad34-bd635175477b', 'tradeoffs', NULL::text,
 'Model output is a recommendation, not a guarantee: it can be confidently wrong about code it has only partially seen, so the assistant is positioned as accelerating understanding rather than replacing review. Context windows bound how much of a system can be analysed at once, which pushes towards chunking and summarisation and away from whole-repository reasoning. Provider abstraction adds a layer, but it is what makes the tool viable for enterprise use where the model may need to change.', 4),

('90931c06-bb9b-467c-ad34-bd635175477b', 'impact', NULL::text,
 'Roughly 60% less time spent on the initial understanding phase in testing, and a markedly better grasp of code structure before any change was attempted. The larger point is where the time went: not into writing new code, but into removing the fear of touching old code.', 5),

-- ── CodeGuardian ──────────────────────────────────────────────────────────
('eb5fa1b7-6c90-4888-898c-5ff657497012', 'why_this_project', NULL::text,
 'Security scanning is usually the last thing added to a project and the first thing skipped when deadlines slip. I wanted to build a scanner from the OWASP Top 10 outwards - partly to have one, but mostly to understand each vulnerability class well enough to detect it, which is a much deeper understanding than reading about it.', 1),

('eb5fa1b7-6c90-4888-898c-5ff657497012', 'problem_statement', NULL::text,
 'Web applications ship with the same classes of vulnerability year after year - injection, cross-site scripting, broken access control - because detection is either manual or locked inside expensive tooling. Small teams need something that can scan an application, find the common failures, and report them in a form a developer can act on.', 2),

('eb5fa1b7-6c90-4888-898c-5ff657497012', 'solution_approach', NULL::text,
 'A MERN-based scanner that tests a target application against OWASP Top 10 categories and generates a report per finding. Detection logic is organised per vulnerability class so that each check is small, testable and independently improvable, rather than one monolithic pass.', 3),

('eb5fa1b7-6c90-4888-898c-5ff657497012', 'tradeoffs', NULL::text,
 'Pattern-based detection is fast and explainable but produces false positives and misses anything context-dependent; it is a first pass, not a substitute for review. Testing a live application is more realistic than static analysis but slower and riskier against production systems, so the scanner is intended for staging environments. Breadth across the Top 10 was prioritised over depth in any single class.', 4),

('eb5fa1b7-6c90-4888-898c-5ff657497012', 'impact', NULL::text,
 'Over fifty vulnerabilities found across more than ten applications tested. The more durable outcome was the working knowledge of each vulnerability class - the difference between knowing XSS exists and knowing exactly what input reaches a sink unescaped - which carried directly into later work on application security.', 5),

-- ── Skillverse ────────────────────────────────────────────────────────────
('f54f2982-df5f-4a32-b0ae-49eb0fdf3ad6', 'why_this_project', NULL::text,
 'People have skills they would happily teach and skills they want to learn, and money is a poor medium of exchange between the two. A bartering model - your hour of design for my hour of backend - removes the barrier, but only works if matching is good and the interaction is immediate.', 1),

('f54f2982-df5f-4a32-b0ae-49eb0fdf3ad6', 'problem_statement', NULL::text,
 'A skill exchange without money needs three things a marketplace usually gets from price: a way to find a good match, a reason to keep participating, and trust that the other side will show up. Matching has to account for what each person offers and wants simultaneously, and the experience has to feel live rather than like leaving a listing and waiting.', 2),

('f54f2982-df5f-4a32-b0ae-49eb0fdf3ad6', 'solution_approach', NULL::text,
 'A MERN platform with authentication, a matching algorithm that pairs users on complementary skill needs, and Socket.IO for real-time communication so matches and conversations happen while both people are present. Gamification supplies the participation incentive that a price would otherwise provide.', 3),

('f54f2982-df5f-4a32-b0ae-49eb0fdf3ad6', 'tradeoffs', NULL::text,
 'Real-time matching is engaging but stateful: presence, rooms and reconnection all have to be handled, which is more complex than a request-response marketplace. Gamification drives participation but can be gamed, so the scoring has to reward completed exchanges rather than activity. Two-sided matching quality depends on liquidity - it is only as good as the number of active users on each side.', 4),

('f54f2982-df5f-4a32-b0ae-49eb0fdf3ad6', 'impact', NULL::text,
 'Over five hundred active users and more than twelve hundred skill matches made. The system that mattered most was the matching-plus-realtime combination: matches that surfaced while both people were online converted, and ones that did not mostly went stale.', 5)

) AS v(project_id, section_type, title, body, sort_order)
WHERE EXISTS (SELECT 1 FROM projects p WHERE p.id = v.project_id::uuid)
ON CONFLICT (project_id, section_type) DO UPDATE
  SET title      = EXCLUDED.title,
      body       = EXCLUDED.body,
      sort_order = EXCLUDED.sort_order;


-- ------------------------------------------------------------
-- 5. POST-CHECK
-- ------------------------------------------------------------
--   -- codeguardian's sections should now mention CodeGuardian, not Skillverse
--   SELECT p.slug, s.title FROM project_sections s
--   JOIN projects p ON p.id = s.project_id
--   WHERE p.slug IN ('codeguardian','skillverse') ORDER BY p.slug, s.sort_order;
--
--   SELECT jsonb_object_keys(meta) FROM profiles WHERE is_active;   -- 7 keys
--   SELECT value FROM site_content WHERE key = 'seo.og_image';       -- real URL
--   SELECT count(*) FROM project_storytelling;                       -- 25
