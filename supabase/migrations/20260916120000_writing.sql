-- ============================================================
-- writing
--
-- Roadmap item 6 (v2-content-sections.md §4): "the strongest senior signal
-- currently missing - even 3-4 posts on the bugs from this audit would be
-- excellent." Two tables on the block model ADR-037 introduced: a post is a
-- row, its body is ordered block rows of the same types the architecture
-- page uses (prose, diagram, steps, table) plus `code`.
--
-- Three posts are seeded as DRAFTS, written from the engineering notes for
-- the author to edit and publish from the dashboard. Nothing is visible
-- until status = 'published': the routes return 404, the list is empty,
-- and the "Writing" navigation item does not render at all. A section is
-- not shipped until it has real content the author has signed off.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. posts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  summary       TEXT CHECK (summary IS NULL OR char_length(summary) <= 300),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at  TIMESTAMPTZ,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  meta          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT posts_published_have_date CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_posts_published ON public.posts (status, published_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read published posts" ON public.posts;
CREATE POLICY "Public can read published posts" ON public.posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at <= NOW());

DROP TRIGGER IF EXISTS trg_update_posts_updated_at ON public.posts;
CREATE TRIGGER trg_update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Flipping status to 'published' from the dashboard should not also
-- require remembering to set a timestamp. The CHECK above still holds
-- because this runs BEFORE it is evaluated.
CREATE OR REPLACE FUNCTION public.stamp_post_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_post_published_at ON public.posts;
CREATE TRIGGER trg_stamp_post_published_at
  BEFORE INSERT OR UPDATE OF status ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.stamp_post_published_at();


-- ------------------------------------------------------------
-- 2. post_blocks - the body, as ordered typed blocks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  block_type  TEXT NOT NULL CHECK (block_type IN ('prose', 'code', 'diagram', 'steps', 'table')),
  heading     TEXT CHECK (heading IS NULL OR char_length(heading) <= 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 300),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_post_blocks_post ON public.post_blocks (post_id, sort_order);

ALTER TABLE public.post_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read blocks of published posts" ON public.post_blocks;
CREATE POLICY "Public can read blocks of published posts" ON public.post_blocks
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_blocks.post_id AND p.status = 'published' AND p.published_at <= NOW()
  ));

DROP TRIGGER IF EXISTS trg_update_post_blocks_updated_at ON public.post_blocks;
CREATE TRIGGER trg_update_post_blocks_updated_at
  BEFORE UPDATE ON public.post_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ------------------------------------------------------------
-- 3. Navigation label (the item renders only when a post is published)
-- ------------------------------------------------------------
INSERT INTO public.site_content (key, value, section, type, is_public)
VALUES ('nav.writing', 'Writing', 'nav', 'text', TRUE)
ON CONFLICT (key) DO NOTHING;


-- ------------------------------------------------------------
-- 4. Three drafts, from the engineering notes. Edit, then publish.
-- ------------------------------------------------------------
INSERT INTO public.posts (slug, title, summary, status, tags)
VALUES
  ('the-rate-limit-that-never-fired',
   'The rate limit that passed every test and never fired',
   'A Postgres trigger counted rows it was not allowed to see. It passed locally as the superuser, and in production it let every message through. On testing as the role that actually runs your code.',
   'draft', ARRAY['postgres', 'rls', 'supabase', 'testing']),
  ('coalesce-and-the-policy-that-let-everyone-in',
   'COALESCE, NULL, and the policy that let everyone in',
   'I rewrote a working authorization predicate to avoid a hardcoded email and shipped a function that returned TRUE for every anonymous visitor. What fail-closed means in SQL, and the four process mistakes underneath the one-line bug.',
   'draft', ARRAY['security', 'postgres', 'rls', 'incident']),
  ('why-every-page-here-renders-per-request',
   'Why every page here renders per request',
   'Static generation was the plan. A nonce-based Content-Security-Policy made it impossible without giving up the policy. The trade, the measurement, and the ten-line escape hatch.',
   'draft', ARRAY['nextjs', 'csp', 'security', 'architecture'])
ON CONFLICT (slug) DO NOTHING;

-- Post 1 --------------------------------------------------------------------
INSERT INTO public.post_blocks (post_id, block_type, heading, sort_order, config)
SELECT p.id, b.block_type, b.heading, b.sort_order, b.config
FROM public.posts p
CROSS JOIN (VALUES
  ('prose', NULL, 10, jsonb_build_object('paragraphs', jsonb_build_array(
    'The contact form on this site is rate-limited in the database: a `BEFORE INSERT` trigger counts how many messages an email address has sent in the last 24 hours and raises on the fourth. I restored that trigger during an audit - production had never actually received it - tested it locally, watched the fourth insert fail as designed, and pushed.',
    'Then I verified it from outside, with the public key, the way a visitor would hit it. Four messages from one address. Four `201 Created`. The trigger existed. It had never fired.'
  ))),
  ('code', 'The trigger, as first written', 20, jsonb_build_object('language', 'sql', 'snippet',
E'CREATE OR REPLACE FUNCTION check_contact_rate_limit()\nRETURNS TRIGGER LANGUAGE plpgsql AS $$\nDECLARE recent_count INTEGER;\nBEGIN\n  SELECT COUNT(*) INTO recent_count\n  FROM contact_messages\n  WHERE email = NEW.email\n    AND created_at > NOW() - INTERVAL ''24 hours'';\n\n  IF recent_count >= 3 THEN\n    RAISE EXCEPTION ''Rate limit exceeded'' USING ERRCODE = ''check_violation'';\n  END IF;\n  RETURN NEW;\nEND $$;')),
  ('prose', 'Why it never fired', 30, jsonb_build_object('paragraphs', jsonb_build_array(
    'A trigger function runs with the privileges of the caller unless you say otherwise. The caller was `anon` - the public role every browser uses - and `anon` had an INSERT policy on `contact_messages` but no SELECT policy. Row Level Security applies inside the trigger exactly as it does anywhere else. The `COUNT(*)` was filtered to the rows anon was allowed to see, which was none. `recent_count` was always zero, and zero is less than three every time.',
    'My local test could not have caught this. I ran it as `postgres`, and superusers bypass RLS entirely. The test was real, it passed, and it proved nothing about production.'
  ))),
  ('code', 'The fix', 40, jsonb_build_object('language', 'sql', 'snippet',
E'CREATE OR REPLACE FUNCTION check_contact_rate_limit()\nRETURNS TRIGGER\nLANGUAGE plpgsql\nSECURITY DEFINER          -- run as the function owner, so the COUNT sees every row\nSET search_path = public  -- required with DEFINER: nobody may shadow the table\nAS $$ ... $$;\n\n-- and the test that would have caught it:\nSET ROLE anon;\nINSERT INTO contact_messages (name, email, message) VALUES (...);  -- x4, expect the 4th to raise\nRESET ROLE;')),
  ('prose', 'The rule I kept', 50, jsonb_build_object('paragraphs', jsonb_build_array(
    '`SECURITY DEFINER` makes the function run as its owner, so the count sees every row. Nothing is returned to the caller except accept or reject, so no data is exposed. Pinning `search_path` is not optional with `DEFINER`: without it a caller who can create objects in an earlier schema could shadow `contact_messages` with their own.',
    'The rule now written into the database README: any trigger or function that reads a table is tested with `SET ROLE anon` before it is pushed, never as postgres. I reproduced the failure that way first, then confirmed three-accepted-fourth-rejected as anon locally, then the same from outside on production.',
    'It was the second time in this project that I verified an authorization-sensitive path as a privileged role and concluded it worked. The check costs one line. The omission cost a production defect both times.'
  )))
) AS b(block_type, heading, sort_order, config)
WHERE p.slug = 'the-rate-limit-that-never-fired'
ON CONFLICT (post_id, sort_order) DO NOTHING;

-- Post 2 --------------------------------------------------------------------
INSERT INTO public.post_blocks (post_id, block_type, heading, sort_order, config)
SELECT p.id, b.block_type, b.heading, b.sort_order, b.config
FROM public.posts p
CROSS JOIN (VALUES
  ('prose', NULL, 10, jsonb_build_object('paragraphs', jsonb_build_array(
    'This site uses Row Level Security as its only authorization boundary: the browser holds a public key, and Postgres decides what that key can see. Admin access ran through one function, `is_admin()`, which compared the email in the caller''s JWT to a hardcoded address. It worked.',
    'In a migration whose purpose was reconciling schema drift, I rewrote it. The hardcoded email offended me; a configuration setting felt cleaner. This is the predicate I shipped.'
  ))),
  ('code', NULL, 20, jsonb_build_object('language', 'sql', 'snippet',
E'COALESCE(auth.jwt() ->> ''email'', '''')\n  = COALESCE(current_setting(''app.admin_email'', TRUE), '''')')),
  ('prose', 'What it does when nothing is there', 30, jsonb_build_object('paragraphs', jsonb_build_array(
    'For an anonymous visitor there is no JWT, so the left side is NULL and coalesces to the empty string. On the hosted database I could not set `app.admin_email` - `ALTER DATABASE ... SET` is not permitted there - so the right side was NULL too, and coalesced to the empty string. Empty equals empty. `is_admin()` returned TRUE for every anonymous request.',
    'Permissive RLS policies are combined with OR. The admin policy on each table was `FOR ALL ... USING (is_admin())`, so once it returned TRUE it overrode every restrictive policy beside it. Anonymous callers had read, insert, update and delete on eleven tables, including the contact messages. For the length of that window, real submissions were publicly readable. I verified afterwards that nothing had been modified or deleted; that is luck, not design.'
  ))),
  ('code', 'Fail closed', 40, jsonb_build_object('language', 'sql', 'snippet',
E'-- NULLIF turns '''' back into NULL, and NULL = anything is not TRUE.\n-- With no JWT or no setting, the comparison is unknown, and unknown is denied.\nNULLIF(auth.jwt() ->> ''email'', '''')\n  = NULLIF(current_setting(''app.admin_email'', TRUE), '''')')),
  ('steps', 'The four mistakes under the one-line bug', 50, jsonb_build_object('steps', jsonb_build_array(
    jsonb_build_object('title', 'A security change as a drive-by', 'body', 'The migration was about drift. The predicate worked. I changed it for style. Authorization code now changes only in a migration that exists to change it, with its own test.'),
    jsonb_build_object('title', 'SQL I could not execute', 'body', 'No local Postgres at the time, so I substituted careful reading for testing. Careful reading is how this bug gets through: `COALESCE(a, '''') = COALESCE(b, '''')` looks symmetric and harmless, and is wrong only when both sides are absent - the exact case a test hits and a read does not.'),
    jsonb_build_object('title', 'Verifying the wrong layer', 'body', 'I checked the policies. I never called the function they depended on. When a later policy fix appeared to do nothing, I diagnosed a naming problem and shipped another migration instead of asking why a correct policy had no effect.'),
    jsonb_build_object('title', 'Not testing as the role that runs it', 'body', 'The same failure caught me again weeks later with a rate-limit trigger. Both times the fix was one line; both times the missing step was `SET ROLE anon` before declaring victory.')
  ))),
  ('prose', NULL, 60, jsonb_build_object('paragraphs', jsonb_build_array(
    'The function now returns FALSE for anything but a JWT whose email equals a configured, non-empty setting. On this site that means it returns FALSE always - there is no login flow - which is the correct answer, and the reason the writes moved behind a server with the service role instead.',
    'I kept the incident in the decision log rather than tidying it away. A write-up with no failures in it is not a credible one.'
  )))
) AS b(block_type, heading, sort_order, config)
WHERE p.slug = 'coalesce-and-the-policy-that-let-everyone-in'
ON CONFLICT (post_id, sort_order) DO NOTHING;

-- Post 3 --------------------------------------------------------------------
INSERT INTO public.post_blocks (post_id, block_type, heading, sort_order, config)
SELECT p.id, b.block_type, b.heading, b.sort_order, b.config
FROM public.posts p
CROSS JOIN (VALUES
  ('prose', NULL, 10, jsonb_build_object('paragraphs', jsonb_build_array(
    'The plan for moving this site from a single-page app to Next.js was the textbook one: static generation with incremental revalidation. Content in the HTML for crawlers and link previews, served from the edge, refreshed when a row changes. I had written it down as a decision before writing a line of code.',
    'It is not what shipped. Every page here renders on the server per request. The reason is a Content-Security-Policy header, and I think the trade is right; here is what it cost.'
  ))),
  ('prose', 'The problem with hashes', 20, jsonb_build_object('paragraphs', jsonb_build_array(
    'The previous build had a strict CSP: scripts only from the origin, plus one sha256 hash for the single inline script that sets the theme before first paint. No `unsafe-inline`. That is the policy that actually stops an injected script from running.',
    'Next.js emits inline scripts on every page - the payload that hydrates server components - and their content varies with the data and the request. You cannot hash what changes on every response. The two remaining options: a per-request nonce with `strict-dynamic`, which requires rendering the page per request because a nonce baked into a static file is not a nonce; or `script-src ''unsafe-inline''`, which is what most Next deployments ship and which disables the policy on the one axis it exists for.'
  ))),
  ('table', 'The trade', 30, jsonb_build_object(
    'columns', jsonb_build_array('', 'Static + ISR with unsafe-inline', 'Per-request render with a nonce'),
    'rows', jsonb_build_array(
      jsonb_build_array('Content in the HTML', 'Yes', 'Yes'),
      jsonb_build_array('Titles, descriptions, share cards per URL', 'Yes', 'Yes'),
      jsonb_build_array('HTML served from the edge cache', 'Yes, ~20 ms', 'No - a function runs; ~400 ms warm, more cold'),
      jsonb_build_array('Scripts allowed to run', 'Any inline script, including an injected one', 'Only scripts carrying this response''s nonce'),
      jsonb_build_array('Data freshness', 'Revalidate on webhook', 'Same: the data is cached and tagged by table; only the HTML is not')
    )
  )),
  ('prose', 'What made it cheap enough', 40, jsonb_build_object('paragraphs', jsonb_build_array(
    'Rendering per request is only expensive if the render does expensive things. Here every content read goes through a Supabase client whose `fetch` is Next''s own, so each read lands in the Data Cache tagged with its table name. A database webhook expires exactly the tag that changed. The render itself is a few milliseconds of React over cached rows; what is given up is the edge cache in front of the HTML.',
    'I measured it after deploying rather than assuming: about 390 ms to first byte, warm, for a 53 kB page, from India. The single-page app it replaced served a 1 kB shell in 30 ms and then needed a JavaScript bundle and a database round-trip before showing anything. The visitor sees content sooner now, not later.'
  ))),
  ('prose', 'The escape hatch', 50, jsonb_build_object('paragraphs', jsonb_build_array(
    'The decision is recorded with its reversal: drop the nonce, add `unsafe-inline`, stop reading request headers in the layout, and every route becomes static. About ten lines. If cold-start latency ever proves unacceptable in practice, that is the change to make, and the record says so. What I did not want was to make the weaker security choice by default because a framework''s happy path assumed it.'
  )))
) AS b(block_type, heading, sort_order, config)
WHERE p.slug = 'why-every-page-here-renders-per-request'
ON CONFLICT (post_id, sort_order) DO NOTHING;


-- ------------------------------------------------------------
-- POST-CHECK (as anon: drafts are invisible)
-- ------------------------------------------------------------
--   SET ROLE anon;
--   SELECT count(*) FROM posts;        -- 0
--   SELECT count(*) FROM post_blocks;  -- 0
--   RESET ROLE;
--   UPDATE posts SET status = 'published' WHERE slug = 'the-rate-limit-that-never-fired';
--   SELECT published_at IS NOT NULL FROM posts WHERE slug = 'the-rate-limit-that-never-fired';  -- true
--   SET ROLE anon;
--   SELECT count(*) FROM posts;        -- 1
--   SELECT count(*) FROM post_blocks;  -- 5
