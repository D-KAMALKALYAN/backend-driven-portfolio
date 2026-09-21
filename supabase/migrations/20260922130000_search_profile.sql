-- ============================================================
-- The person joins the corpus (ADR-051 addendum)
--
-- "Tell me about Kamal" retrieved an analytics section - the only source
-- with his name in it - and the model said, correctly, that it knew nothing
-- about him. The About page's profile (name, title, bio, location) was never
-- in search_content(), so neither the palette nor Ask could find it. Same
-- gap the credentials had (2026-09-21). Added as kind 'profile' (→ /about),
-- with a few plain synonyms for how a visitor asks. RLS: profiles are public
-- while is_active.
--
-- Both functions are redefined in full, as every redefinition here is.
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

    -- The person. "Tell me about Kamal" had no source that was about Kamal.
    UNION ALL
    SELECT 'profile', pr.full_name, pr.title, '/about',
           (setweight(to_tsvector('english', coalesce(pr.full_name, '')), 'A')
            || setweight(to_tsvector('english', coalesce(pr.title, '')), 'A')
            || setweight(to_tsvector('english', coalesce(pr.bio, '')), 'B')
            || setweight(to_tsvector('english', coalesce(pr.location, '')), 'C')
            || setweight(to_tsvector('english', 'about profile bio background who is kamal himself person'), 'D'))
    FROM profiles pr
    WHERE pr.is_active = TRUE
  )
  SELECT d.kind, d.title, d.snippet, d.href, ts_rank_cd(d.doc, tsq)::real AS rank
  FROM docs d
  WHERE d.doc @@ tsq
  ORDER BY rank DESC, d.title
  LIMIT GREATEST(1, LEAST(coalesce(max_results, 8), 20));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_content(TEXT, INTEGER) TO anon, authenticated, service_role;


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
        WHEN 'profile' THEN (
          SELECT concat_ws(E'
', pr.full_name || ' - ' || coalesce(pr.title, ''), pr.bio, 'Based in ' || pr.location)
          FROM profiles pr WHERE pr.full_name = c.title AND pr.is_active = TRUE LIMIT 1)
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

-- The answers that said "the sources do not cover this" were recorded as
-- 'answered' and would be served from the ledger for a week - a week in
-- which the content may arrive (the profile just did). Retired; the route
-- records such answers as 'failed' from now on (src/ai/prompt.ts isNonAnswer).
UPDATE public.ask_log
SET status = 'failed'
WHERE status = 'answered'
  AND answer ~* '\m(do(es)? not (contain|cover|mention|include|describe)|don''?t (contain|cover|mention)|couldn''?t find|could not find|no information|not (contain|cover)ed in the sources|nothing (about|on) (this|that))\M';

-- POST-CHECK (as anon)
--   SELECT kind, title FROM search_content('kamal');                       -- a profile row
--   SELECT kind, title, left(body, 80) FROM ask_context('tell me about kamal');
