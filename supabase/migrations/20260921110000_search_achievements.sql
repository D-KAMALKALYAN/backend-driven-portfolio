-- ============================================================
-- search + ask: credentials are content too
--
-- The first production question the owner's certification could not answer
-- was "Which certifications does Kamal have?" - achievements were never in
-- the search corpus, so neither the palette nor ask_context() could find
-- them. Both use search_content(), so one change covers both: achievements
-- join the UNION as kind 'credential', linking to /about where they render.
-- Same RLS posture as everything else (the anon SELECT policy decides).
--
-- SAFE TO RE-RUN.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_content(q TEXT, max_results INTEGER DEFAULT 8)
RETURNS TABLE (kind TEXT, title TEXT, snippet TEXT, href TEXT, rank REAL)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  cleaned TEXT := left(btrim(coalesce(q, '')), 100);
  tsq     tsquery;
BEGIN
  IF char_length(cleaned) < 2 THEN
    RETURN;
  END IF;

  tsq := websearch_to_tsquery('english', cleaned);
  IF cleaned !~ '\s' AND cleaned ~ '^[[:alnum:]_-]+$' THEN
    tsq := tsq || to_tsquery('simple', quote_literal(lower(cleaned)) || ':*');
  END IF;
  IF tsq IS NULL OR numnode(tsq) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH docs AS (
    SELECT 'project'::text AS kind, p.title,
           coalesce(p.tagline, left(p.description, 160)) AS snippet,
           '/projects/' || p.slug AS href,
           (setweight(to_tsvector('english', coalesce(p.title, '')), 'A')
            || setweight(to_tsvector('english', coalesce(p.tagline, '')), 'B')
            || setweight(to_tsvector('english', coalesce(p.description, '')), 'C')
            || setweight(to_tsvector('simple', array_to_string(coalesce(p.tech_stack, '{}'), ' ')), 'B')
            || setweight(to_tsvector('simple', array_to_string(coalesce(p.tags, '{}'), ' ')), 'B')) AS doc
    FROM projects p
    WHERE p.status = 'published' AND p.is_deleted = FALSE

    UNION ALL
    SELECT 'post', po.title, po.summary, '/writing/' || po.slug,
           (setweight(to_tsvector('english', coalesce(po.title, '')), 'A')
            || setweight(to_tsvector('english', coalesce(po.summary, '')), 'B')
            || setweight(to_tsvector('simple', array_to_string(coalesce(po.tags, '{}'), ' ')), 'B')
            || setweight(to_tsvector('english', coalesce(b.body, '')), 'C'))
    FROM posts po
    LEFT JOIN LATERAL (
      SELECT string_agg(coalesce(pb.heading, '') || ' ' || coalesce(pb.config::text, ''), ' ') AS body
      FROM post_blocks pb WHERE pb.post_id = po.id
    ) b ON TRUE
    WHERE po.status = 'published' AND po.published_at <= NOW()

    UNION ALL
    SELECT 'skill', s.name, s.category, '/skills',
           (setweight(to_tsvector('simple', coalesce(s.name, '')), 'A')
            || setweight(to_tsvector('simple', coalesce(s.category, '')), 'C'))
    FROM skills s
    WHERE s.is_deleted = FALSE

    UNION ALL
    SELECT 'experience', e.role, e.company, '/experience',
           (setweight(to_tsvector('english', coalesce(e.role, '')), 'A')
            || setweight(to_tsvector('english', coalesce(e.company, '')), 'A')
            || setweight(to_tsvector('english', coalesce(e.description, '')), 'C')
            || setweight(to_tsvector('simple', array_to_string(coalesce(e.tech_used, '{}'), ' ')), 'B'))
    FROM experience e
    WHERE e.is_deleted = FALSE

    -- Certifications, awards, publications: the About page's achievements.
    UNION ALL
    SELECT 'credential', a.title,
           concat_ws(' · ', a.issuer, a.type, to_char(a.date_earned, 'Mon YYYY')),
           '/about',
           (setweight(to_tsvector('english', coalesce(a.title, '')), 'A')
            || setweight(to_tsvector('english', coalesce(a.issuer, '')), 'B')
            -- 'english' here on purpose: the stemmer turns "certifications" (a
            -- question) and "certified" (a title) into different stems, so the
            -- type and a few plain synonyms are indexed with the same stemmer
            -- the query uses.
            || setweight(to_tsvector('english', coalesce(a.type, '')), 'B')
            || setweight(to_tsvector('english', 'certification certifications certified credential credentials award awards badge'), 'D')
            || setweight(to_tsvector('english', coalesce(a.description, '')), 'C'))
    FROM achievements a
  )
  SELECT d.kind, d.title, d.snippet, d.href, ts_rank_cd(d.doc, tsq)::real AS rank
  FROM docs d
  WHERE d.doc @@ tsq
  ORDER BY rank DESC, d.title
  LIMIT GREATEST(1, LEAST(coalesce(max_results, 8), 20));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_content(TEXT, INTEGER) TO anon, authenticated, service_role;

-- ask_context(): give a credential its full text (issuer, type, date, description, link).
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
        WHEN 'credential' THEN (
          SELECT concat_ws(E'\n',
            concat_ws(' · ', a.type, 'issued by ' || a.issuer, 'earned ' || to_char(a.date_earned, 'Month YYYY')),
            a.description,
            'Verify: ' || a.credential_url)
          FROM achievements a WHERE a.title = h.title
          ORDER BY a.date_earned DESC NULLS LAST LIMIT 1)
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

GRANT EXECUTE ON FUNCTION public.ask_context(TEXT, INTEGER) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- POST-CHECK (as anon)
-- ------------------------------------------------------------
--   SELECT kind, title FROM search_content('certification');   -- credential rows
--   SELECT kind, title, body FROM ask_context('Which certifications does Kamal have?');
