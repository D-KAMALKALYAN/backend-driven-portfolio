-- ============================================================
-- ask retrieval: questions are not search strings
--
-- The first ask_context() handed the question straight to search_content(),
-- whose websearch_to_tsquery ANDs every word. "How does the rate limiter
-- handle tenants?" then requires a document containing "handle" - none
-- does - and the model is told there are no sources. The palette's search
-- box wants AND (narrowing as you type); a question wants OR with ranking
-- (the document that matches most of the words comes first).
--
-- ask_query_terms() turns a question into that: distinct words of four or
-- more letters, at most eight, joined with " or " - which websearch syntax
-- understands - and short enough to survive search_content()'s 100-char cap.
--
-- SAFE TO RE-RUN.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ask_query_terms(q TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(string_agg(w, ' or '), '')
  FROM (
    SELECT DISTINCT ON (lower(w)) w
    FROM regexp_split_to_table(lower(coalesce(q, '')), '[^[:alnum:]_-]+') AS w
    WHERE length(w) >= 4
    ORDER BY lower(w), w
    LIMIT 8
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.ask_context(q TEXT, max_docs INTEGER DEFAULT 6)
RETURNS TABLE (kind TEXT, title TEXT, href TEXT, body TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH terms AS (
    SELECT ask_query_terms(q) AS t
  ),
  hits AS (
    SELECT s.kind, s.title, s.href, s.snippet, s.rank
    FROM terms, search_content(terms.t, GREATEST(1, LEAST(coalesce(max_docs, 6), 10))) s
    WHERE terms.t <> ''
  ),
  pages AS (
    SELECT 'page'::text AS kind,
           ps.heading AS title,
           '/how-it-works' AS href,
           left(concat_ws(E'\n', ps.heading, jsonb_strings(ps.config)), 2500) AS body,
           ts_rank_cd(to_tsvector('english', coalesce(ps.heading, '') || ' ' || coalesce(jsonb_strings(ps.config), '')),
                      websearch_to_tsquery('english', terms.t))::real AS rank
    FROM terms, page_sections ps
    WHERE terms.t <> ''
      AND ps.page = 'how_it_works' AND ps.is_visible
      AND to_tsvector('english', coalesce(ps.heading, '') || ' ' || coalesce(jsonb_strings(ps.config), ''))
          @@ websearch_to_tsquery('english', terms.t)
  ),
  docs AS (
    SELECT h.kind, h.title, h.href, h.rank,
      left(CASE h.kind
        WHEN 'project' THEN (
          SELECT concat_ws(E'\n',
            p.tagline, p.description,
            'Tech: ' || array_to_string(coalesce(p.tech_stack, '{}'), ', '),
            (SELECT string_agg(coalesce(st.title, st.section_type) || ': ' || st.body, E'\n' ORDER BY st.sort_order)
             FROM project_storytelling st WHERE st.project_id = p.id))
          FROM projects p WHERE '/projects/' || p.slug = h.href)
        WHEN 'post' THEN (
          SELECT concat_ws(E'\n',
            po.summary,
            (SELECT string_agg(concat_ws(' ', b.heading, jsonb_strings(b.config)), E'\n' ORDER BY b.sort_order)
             FROM post_blocks b WHERE b.post_id = po.id))
          FROM posts po WHERE '/writing/' || po.slug = h.href)
        WHEN 'experience' THEN (
          SELECT concat_ws(E'\n', e.company, e.description, array_to_string(coalesce(e.highlights, '{}'), E'\n'))
          FROM experience e WHERE e.role = h.title AND e.is_deleted = FALSE
          ORDER BY e.is_current DESC NULLS LAST LIMIT 1)
        ELSE h.snippet
      END, 2500) AS body
    FROM hits h
    UNION ALL
    SELECT kind, title, href, rank, body FROM pages
  )
  SELECT d.kind, d.title, d.href, d.body
  FROM docs d
  WHERE d.body IS NOT NULL AND btrim(d.body) <> ''
  ORDER BY d.rank DESC, d.title
  LIMIT GREATEST(1, LEAST(coalesce(max_docs, 6), 10));
$$;

GRANT EXECUTE ON FUNCTION public.ask_query_terms(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ask_context(TEXT, INTEGER) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select ask_query_terms('How does the rate limiter handle tenants?');
--   -> 'does or handle or limiter or rate or tenants'   (order is alphabetical; irrelevant to OR)
--   set role anon; select kind, title from ask_context('How does the rate limiter handle tenants?');
--   -> the rate limiter project first
