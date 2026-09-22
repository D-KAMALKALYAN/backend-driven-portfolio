-- ============================================================
-- V3 step 8: hybrid retrieval (ADR-055, blueprint 3.6)
--
-- Lexical retrieval has a ceiling: "what did Kamal build to help with old
-- codebases?" finds nothing, because no page says "old codebases" - it says
-- "legacy". Measured on the live corpus with scripts/ai-eval.mjs before this
-- change: hit@1 10/20, hit@3 13/20, 5 misses.
--
-- 1. content_chunks - the corpus, chunked and embedded by the owner-run
--    indexer (npm run ai:index; OpenAI text-embedding-3-small, 1536 dims).
--    Chunks are derived from public content, but a note unpublished after
--    the last run would still have chunks, so the table's RLS mirrors
--    visibility by href: a chunk is readable only while its page is. Bodies
--    the model reads are never taken from here - ask_context() rebuilds
--    them from the live tables under their own RLS; a chunk only nominates.
--
-- 2. ask_corpus() - every document as (kind, title, href, body), the same
--    bodies ask_context() gives the model. SECURITY INVOKER: the indexer
--    reads it with the anon key, so it can only index what anon can read.
--
-- 3. ask_context(q, max_docs, scope_href, q_embedding) - hybrid: the lexical
--    candidates (search_content + how-it-works sections) and the semantic
--    candidates (best chunk per document by cosine similarity) fused by
--    reciprocal rank (k = 60), then the scope boost as before, then the live
--    bodies. Without an embedding (no key, the call failed, nothing indexed)
--    it is the lexical function it was. No HNSW index: the corpus is a few
--    hundred chunks; a scan is microseconds and an index would be a promise
--    the numbers do not need.
--
-- 4. ask_index_state() - chunks, when they were indexed, and whether content
--    changed since; service role only, surfaced by /api/health.
--
-- SAFE TO RE-RUN.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;


-- ------------------------------------------------------------
-- 1. content_chunks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL,
  title        TEXT NOT NULL,
  href         TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL DEFAULT 0,
  body         TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding    extensions.vector(1536),
  indexed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, title, href, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_content_chunks_href ON public.content_chunks (href);

ALTER TABLE public.content_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chunks are readable while their page is" ON public.content_chunks;
CREATE POLICY "Chunks are readable while their page is" ON public.content_chunks
  FOR SELECT TO PUBLIC
  -- The chunk's columns are qualified: unqualified, `title` inside the
  -- profiles subquery resolved to profiles.title (the job title) and hid
  -- every profile chunk; achievements.title would have matched itself.
  USING (
    (content_chunks.kind = 'project' AND EXISTS (SELECT 1 FROM public.projects p WHERE '/projects/' || p.slug = content_chunks.href AND p.status = 'published' AND p.is_deleted = FALSE))
    OR (content_chunks.kind = 'post' AND EXISTS (SELECT 1 FROM public.posts po WHERE '/writing/' || po.slug = content_chunks.href AND po.status = 'published' AND po.published_at <= NOW()))
    OR (content_chunks.kind = 'page' AND EXISTS (SELECT 1 FROM public.page_sections ps WHERE ps.page = 'how_it_works' AND ps.is_visible AND ps.heading = content_chunks.title))
    OR (content_chunks.kind = 'experience' AND EXISTS (SELECT 1 FROM public.experience e WHERE e.role = content_chunks.title AND e.is_deleted = FALSE))
    OR (content_chunks.kind = 'credential' AND EXISTS (SELECT 1 FROM public.achievements a WHERE a.title = content_chunks.title))
    OR (content_chunks.kind = 'profile' AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.full_name = content_chunks.title AND pr.is_active = TRUE))
  );
GRANT SELECT ON public.content_chunks TO anon, authenticated;
GRANT ALL ON public.content_chunks TO service_role;


-- ------------------------------------------------------------
-- 2. ask_corpus
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ask_corpus()
RETURNS TABLE (kind TEXT, title TEXT, href TEXT, body TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH c AS (
    SELECT 'project'::text AS kind, p.title, '/projects/' || p.slug AS href, NULL::text AS snippet FROM projects p WHERE p.status = 'published' AND p.is_deleted = FALSE
    UNION ALL SELECT 'post', po.title, '/writing/' || po.slug, NULL FROM posts po WHERE po.status = 'published' AND po.published_at <= NOW()
    UNION ALL SELECT 'experience', e.role, '/experience', NULL FROM experience e WHERE e.is_deleted = FALSE
    UNION ALL SELECT 'credential', a.title, '/about', NULL FROM achievements a
    UNION ALL SELECT 'profile', pr.full_name, '/about', NULL FROM profiles pr WHERE pr.is_active = TRUE
    UNION ALL SELECT 'page', ps.heading, '/how-it-works', NULL FROM page_sections ps WHERE ps.page = 'how_it_works' AND ps.is_visible AND ps.heading IS NOT NULL
  )
  SELECT c.kind, c.title, c.href, left(CASE c.kind
        WHEN 'project' THEN (
          SELECT concat_ws(E'\n',
            p.tagline, p.description,
            'Tech: ' || array_to_string(coalesce(p.tech_stack, '{}'), ', '),
            (SELECT string_agg(coalesce(st.title, st.section_type) || ': ' || st.body, E'\n' ORDER BY st.sort_order)
             FROM project_storytelling st WHERE st.project_id = p.id))
          FROM projects p WHERE '/projects/' || p.slug = c.href)
        WHEN 'post' THEN (
          SELECT concat_ws(E'\n',
            po.summary,
            (SELECT string_agg(concat_ws(' ', b.heading, jsonb_strings(b.config)), E'\n' ORDER BY b.sort_order)
             FROM post_blocks b WHERE b.post_id = po.id))
          FROM posts po WHERE '/writing/' || po.slug = c.href)
        WHEN 'experience' THEN (
          SELECT concat_ws(E'\n', e.company, e.description, array_to_string(coalesce(e.highlights, '{}'), E'\n'))
          FROM experience e WHERE e.role = c.title AND e.is_deleted = FALSE
          ORDER BY e.is_current DESC NULLS LAST LIMIT 1)
        WHEN 'credential' THEN (
          SELECT concat_ws(E'\n',
            concat_ws(' · ', a.type, 'issued by ' || a.issuer, 'earned ' || to_char(a.date_earned, 'Month YYYY')),
            a.description,
            'Verify: ' || a.credential_url)
          FROM achievements a WHERE a.title = c.title
          ORDER BY a.date_earned DESC NULLS LAST LIMIT 1)
        WHEN 'profile' THEN (
          SELECT concat_ws(E'\n', pr.full_name || ' - ' || coalesce(pr.title, ''), pr.bio, 'Based in ' || pr.location)
          FROM profiles pr WHERE pr.full_name = c.title AND pr.is_active = TRUE LIMIT 1)
        WHEN 'page' THEN (
          SELECT concat_ws(E'\n', ps.heading, jsonb_strings(ps.config))
          FROM page_sections ps WHERE ps.page = 'how_it_works' AND ps.is_visible AND ps.heading = c.title LIMIT 1)
        ELSE c.snippet
      END, 6000) AS body
  FROM c
  WHERE btrim(coalesce(CASE c.kind
        WHEN 'project' THEN (
          SELECT concat_ws(E'\n',
            p.tagline, p.description,
            'Tech: ' || array_to_string(coalesce(p.tech_stack, '{}'), ', '),
            (SELECT string_agg(coalesce(st.title, st.section_type) || ': ' || st.body, E'\n' ORDER BY st.sort_order)
             FROM project_storytelling st WHERE st.project_id = p.id))
          FROM projects p WHERE '/projects/' || p.slug = c.href)
        WHEN 'post' THEN (
          SELECT concat_ws(E'\n',
            po.summary,
            (SELECT string_agg(concat_ws(' ', b.heading, jsonb_strings(b.config)), E'\n' ORDER BY b.sort_order)
             FROM post_blocks b WHERE b.post_id = po.id))
          FROM posts po WHERE '/writing/' || po.slug = c.href)
        WHEN 'experience' THEN (
          SELECT concat_ws(E'\n', e.company, e.description, array_to_string(coalesce(e.highlights, '{}'), E'\n'))
          FROM experience e WHERE e.role = c.title AND e.is_deleted = FALSE
          ORDER BY e.is_current DESC NULLS LAST LIMIT 1)
        WHEN 'credential' THEN (
          SELECT concat_ws(E'\n',
            concat_ws(' · ', a.type, 'issued by ' || a.issuer, 'earned ' || to_char(a.date_earned, 'Month YYYY')),
            a.description,
            'Verify: ' || a.credential_url)
          FROM achievements a WHERE a.title = c.title
          ORDER BY a.date_earned DESC NULLS LAST LIMIT 1)
        WHEN 'profile' THEN (
          SELECT concat_ws(E'\n', pr.full_name || ' - ' || coalesce(pr.title, ''), pr.bio, 'Based in ' || pr.location)
          FROM profiles pr WHERE pr.full_name = c.title AND pr.is_active = TRUE LIMIT 1)
        WHEN 'page' THEN (
          SELECT concat_ws(E'\n', ps.heading, jsonb_strings(ps.config))
          FROM page_sections ps WHERE ps.page = 'how_it_works' AND ps.is_visible AND ps.heading = c.title LIMIT 1)
        ELSE c.snippet
      END, '')) <> '';
$$;
GRANT EXECUTE ON FUNCTION public.ask_corpus() TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 3. ask_context, hybrid
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ask_context(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.ask_context(q TEXT, max_docs INTEGER DEFAULT 6, scope_href TEXT DEFAULT NULL, q_embedding extensions.vector DEFAULT NULL)
RETURNS TABLE (kind TEXT, title TEXT, href TEXT, body TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH terms AS (
    SELECT ask_query_terms(q) AS t, websearch_to_tsquery('english', ask_query_terms(q)) AS tq
  ),
  -- Lexical candidates: search_content over the records, and the how-it-works sections.
  lex AS (
    SELECT s.kind, s.title, s.href, s.snippet, s.rank
    FROM terms, search_content(terms.t, GREATEST(1, LEAST(coalesce(max_docs, 6), 10))) s
    WHERE terms.t <> ''
    UNION ALL
    SELECT 'page', ps.heading, '/how-it-works', NULL, ts_rank_cd(m.tsv, terms.tq)
    FROM terms, page_sections ps
    CROSS JOIN LATERAL (SELECT to_tsvector('english', coalesce(ps.heading, '') || ' ' || coalesce(jsonb_strings(ps.config), '')) AS tsv) m
    WHERE terms.t <> '' AND ps.page = 'how_it_works' AND ps.is_visible AND ps.heading IS NOT NULL AND m.tsv @@ terms.tq
  ),
  lex_ranked AS (SELECT l.*, row_number() OVER (ORDER BY l.rank DESC) AS r FROM lex l),
  -- Semantic candidates: the best chunk of each document, by cosine similarity. RLS on content_chunks decides what is visible.
  sem AS (
    SELECT c.kind, c.title, c.href, MAX(1 - (c.embedding OPERATOR(extensions.<=>) q_embedding)) AS sim
    FROM content_chunks c
    WHERE q_embedding IS NOT NULL AND c.embedding IS NOT NULL
    GROUP BY c.kind, c.title, c.href
    ORDER BY sim DESC
    LIMIT 12
  ),
  sem_ranked AS (SELECT s.*, row_number() OVER (ORDER BY s.sim DESC) AS r FROM sem s),
  -- Reciprocal rank fusion (k = 60): a document found by both leads; one found by either still competes.
  fused AS (
    SELECT coalesce(l.kind, s.kind) AS kind, coalesce(l.title, s.title) AS title, coalesce(l.href, s.href) AS href, l.snippet,
           (coalesce(1.0 / (60 + l.r), 0) + coalesce(1.0 / (60 + s.r), 0))::real AS rank
    FROM lex_ranked l
    FULL OUTER JOIN sem_ranked s ON s.kind = l.kind AND s.title = l.title AND s.href = l.href
  ),
  -- The page being read (ADR-051), by href, whatever the words: one row or none.
  scoped AS (
    SELECT 'project'::text AS kind, p.title, '/projects/' || p.slug AS href FROM projects p WHERE scope_href IS NOT NULL AND scope_href = '/projects/' || p.slug
    UNION ALL
    SELECT 'post', po.title, '/writing/' || po.slug FROM posts po WHERE scope_href IS NOT NULL AND scope_href = '/writing/' || po.slug
    UNION ALL
    SELECT 'page', ps.heading, '/how-it-works' FROM page_sections ps WHERE scope_href = '/how-it-works' AND ps.page = 'how_it_works' AND ps.is_visible AND ps.heading IS NOT NULL
  ),
  candidates AS (
    SELECT f.kind, f.title, f.href, f.snippet,
           f.rank + CASE WHEN f.href = scope_href THEN 10 ELSE 0 END AS rank
    FROM fused f
    UNION ALL
    -- Scoped rows nothing found: the project or post at the top; the page's sections trailing in page order below any real hit.
    SELECT s.kind, s.title, s.href, NULL::text,
           CASE WHEN s.kind = 'page' THEN (0.0001 - coalesce((SELECT ps.sort_order FROM page_sections ps WHERE ps.page = 'how_it_works' AND ps.heading = s.title LIMIT 1), 0) / 1000000.0)::real ELSE 10::real END
    FROM scoped s
    WHERE NOT EXISTS (SELECT 1 FROM fused f WHERE f.kind = s.kind AND f.title = s.title AND f.href = s.href)
  ),
  docs AS (
    SELECT c.kind, c.title, c.href, c.rank, left(CASE c.kind
        WHEN 'project' THEN (
          SELECT concat_ws(E'\n',
            p.tagline, p.description,
            'Tech: ' || array_to_string(coalesce(p.tech_stack, '{}'), ', '),
            (SELECT string_agg(coalesce(st.title, st.section_type) || ': ' || st.body, E'\n' ORDER BY st.sort_order)
             FROM project_storytelling st WHERE st.project_id = p.id))
          FROM projects p WHERE '/projects/' || p.slug = c.href)
        WHEN 'post' THEN (
          SELECT concat_ws(E'\n',
            po.summary,
            (SELECT string_agg(concat_ws(' ', b.heading, jsonb_strings(b.config)), E'\n' ORDER BY b.sort_order)
             FROM post_blocks b WHERE b.post_id = po.id))
          FROM posts po WHERE '/writing/' || po.slug = c.href)
        WHEN 'experience' THEN (
          SELECT concat_ws(E'\n', e.company, e.description, array_to_string(coalesce(e.highlights, '{}'), E'\n'))
          FROM experience e WHERE e.role = c.title AND e.is_deleted = FALSE
          ORDER BY e.is_current DESC NULLS LAST LIMIT 1)
        WHEN 'credential' THEN (
          SELECT concat_ws(E'\n',
            concat_ws(' · ', a.type, 'issued by ' || a.issuer, 'earned ' || to_char(a.date_earned, 'Month YYYY')),
            a.description,
            'Verify: ' || a.credential_url)
          FROM achievements a WHERE a.title = c.title
          ORDER BY a.date_earned DESC NULLS LAST LIMIT 1)
        WHEN 'profile' THEN (
          SELECT concat_ws(E'\n', pr.full_name || ' - ' || coalesce(pr.title, ''), pr.bio, 'Based in ' || pr.location)
          FROM profiles pr WHERE pr.full_name = c.title AND pr.is_active = TRUE LIMIT 1)
        WHEN 'page' THEN (
          SELECT concat_ws(E'\n', ps.heading, jsonb_strings(ps.config))
          FROM page_sections ps WHERE ps.page = 'how_it_works' AND ps.is_visible AND ps.heading = c.title LIMIT 1)
        ELSE c.snippet
      END, 2500) AS body
    FROM candidates c
  )
  SELECT d.kind, d.title, d.href, d.body
  FROM docs d
  WHERE d.body IS NOT NULL AND btrim(d.body) <> ''
  ORDER BY d.rank DESC, d.title
  LIMIT GREATEST(1, LEAST(coalesce(max_docs, 6), 10));
$$;
GRANT EXECUTE ON FUNCTION public.ask_context(TEXT, INTEGER, TEXT, extensions.vector) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 4. ask_index_state
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ask_index_state()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'chunks', (SELECT count(*) FROM content_chunks),
    'documents', (SELECT count(DISTINCT (kind, title, href)) FROM content_chunks),
    'indexed_at', (SELECT max(indexed_at) FROM content_chunks),
    'content_changed_at', (
      SELECT max(t) FROM (
        SELECT max(updated_at) AS t FROM projects
        UNION ALL SELECT max(updated_at) FROM posts
        UNION ALL SELECT max(updated_at) FROM post_blocks
        UNION ALL SELECT max(updated_at) FROM page_sections
        UNION ALL SELECT max(updated_at) FROM experience
        UNION ALL SELECT max(updated_at) FROM achievements
        UNION ALL SELECT max(updated_at) FROM profiles
        UNION ALL SELECT max(created_at) FROM project_storytelling
      ) x
    )
  );
$$;
REVOKE ALL ON FUNCTION public.ask_index_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ask_index_state() TO service_role;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   set role anon;
--   select kind, title, href, length(body) from ask_corpus();                            -- every public document
--   select kind, title from ask_context('summarize this', 6, '/projects/<slug>');         -- unchanged behaviour without an embedding
--   select count(*) from content_chunks;                                                  -- only chunks of visible pages
--   reset role; npm run ai:index; npm run ai:eval                                         -- then the numbers in the ADR
