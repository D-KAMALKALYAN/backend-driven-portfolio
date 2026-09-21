-- ============================================================
-- ask_context() learns where the visitor is (ADR-051, blueprint 3.1)
--
-- "Summarize this project", asked on a project page, has no words that
-- find the project: retrieval went by the question alone and the brief's
-- core scenario did not work. ask_context() now takes scope_href - the
-- page the visitor is reading, as the client claims it and the route
-- validated it (a project, a post, or /how-it-works) - and:
--
--   * fetches that page by href whatever the words say, so it is always a
--     source, and lifts it to the top (rank + 10);
--   * for /how-it-works, lifts the sections that match the question above
--     everything else and lets the rest trail in page order below any real
--     hit, so "summarize this page" reads the page and "how is content
--     cached" still finds a post about caching;
--   * never filters: the other pages still compete for the remaining slots.
--     A scope is a boost, not a wall - the answer may need another page.
--
-- RLS still bounds every read: the scoped fetch runs as the caller, so a
-- draft's href scopes nothing for anon. The two-argument signature is
-- dropped - one function, one resolution for PostgREST.
--
-- SAFE TO RE-RUN.
-- ============================================================
DROP FUNCTION IF EXISTS public.ask_context(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.ask_context(q TEXT, max_docs INTEGER DEFAULT 6, scope_href TEXT DEFAULT NULL)
RETURNS TABLE (kind TEXT, title TEXT, href TEXT, body TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH terms AS (
    SELECT ask_query_terms(q) AS t, websearch_to_tsquery('english', ask_query_terms(q)) AS tq
  ),
  hits AS (
    SELECT s.kind, s.title, s.href, s.snippet, s.rank
    FROM terms, search_content(terms.t, GREATEST(1, LEAST(coalesce(max_docs, 6), 10))) s
    WHERE terms.t <> ''
  ),
  -- The page being read, by href, whatever the words. One row or none.
  scoped AS (
    SELECT 'project'::text AS kind, p.title, '/projects/' || p.slug AS href
    FROM projects p WHERE scope_href IS NOT NULL AND scope_href = '/projects/' || p.slug
    UNION ALL
    SELECT 'post', po.title, '/writing/' || po.slug
    FROM posts po WHERE scope_href IS NOT NULL AND scope_href = '/writing/' || po.slug
  ),
  candidates AS (
    SELECT h.kind, h.title, h.href, h.snippet,
           h.rank + CASE WHEN h.href = scope_href THEN 10 ELSE 0 END AS rank
    FROM hits h
    UNION ALL
    SELECT s.kind, s.title, s.href, NULL::text, 10::real
    FROM scoped s
    WHERE NOT EXISTS (SELECT 1 FROM hits h WHERE h.href = s.href)
  ),
  -- The architecture page is not in search_content (it is a page, not a
  -- record); its sections are matched here, and all of them are candidates
  -- when the page itself is the scope.
  pages AS (
    SELECT 'page'::text AS kind,
           ps.heading AS title,
           '/how-it-works' AS href,
           left(concat_ws(E'\n', ps.heading, jsonb_strings(ps.config)), 2500) AS body,
           (CASE WHEN m.matches THEN ts_rank_cd(m.tsv, terms.tq) ELSE 0 END
            + CASE WHEN scope_href = '/how-it-works'
                   THEN CASE WHEN m.matches THEN 10 ELSE 0.0001 - ps.sort_order / 1000000.0 END
                   ELSE 0 END)::real AS rank
    FROM terms, page_sections ps
    CROSS JOIN LATERAL (
      SELECT tsv, CASE WHEN terms.t <> '' THEN tsv @@ terms.tq ELSE FALSE END AS matches
      FROM (SELECT to_tsvector('english', coalesce(ps.heading, '') || ' ' || coalesce(jsonb_strings(ps.config), '')) AS tsv) v
    ) m
    WHERE ps.page = 'how_it_works' AND ps.is_visible
      AND (m.matches OR scope_href = '/how-it-works')
  ),
  docs AS (
    SELECT c.kind, c.title, c.href, c.rank,
      left(CASE c.kind
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
        ELSE c.snippet
      END, 2500) AS body
    FROM candidates c
    UNION ALL
    SELECT kind, title, href, rank, body FROM pages
  )
  SELECT d.kind, d.title, d.href, d.body
  FROM docs d
  WHERE d.body IS NOT NULL AND btrim(d.body) <> ''
  ORDER BY d.rank DESC, d.title
  LIMIT GREATEST(1, LEAST(coalesce(max_docs, 6), 10));
$$;

GRANT EXECUTE ON FUNCTION public.ask_context(TEXT, INTEGER, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- POST-CHECK (as anon)
-- ------------------------------------------------------------
--   SELECT kind, title, href FROM ask_context('summarize this', 6, '/projects/<slug>');   -- the project, alone or first
--   SELECT kind, title, href FROM ask_context('how is content cached?', 6, '/projects/<slug>');  -- the project first, then the real hits
--   SELECT kind, title FROM ask_context('summarize this page', 6, '/how-it-works');        -- sections in page order
--   SELECT kind, title FROM ask_context('how is content cached?', 6, '/how-it-works');    -- matching sections first
--   SELECT count(*) FROM ask_context('summarize this', 6, '/writing/<draft-slug>');       -- 0 or unrelated: a draft scopes nothing
