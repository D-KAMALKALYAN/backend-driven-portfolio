-- ============================================================
-- experience: findable, in the words the resume uses
--
-- Two halves of one problem, found by running search_content() against
-- production as anon after 20260924090000 moved the detail of each role
-- into `highlights`.
--
-- 1. The experience branch of search_content indexed role, company,
--    description and tech_used - not highlights. "Mockito" and "Swagger"
--    matched the backend role (both are in tech_used); "injection flaws"
--    and "false positives" matched nothing, though both are in the
--    highlights. One line, at weight C, the same weight description
--    carries. ask_context() runs its lexical half through this function,
--    so /ask gains the same reach; ask_corpus() already put highlights in
--    the body it hands the model (20260922160000), so this closes the gap
--    between what can be retrieved and what can be read.
--
-- 2. Two points had been paraphrased past their own vocabulary. The work
--    is called metadata-driven configuration and the prototypes were
--    proof-of-concept implementations built to test feasibility; written
--    without those words, "metadata driven configuration" and "prototype
--    feasibility" returned nothing even with highlights indexed. The
--    rewrite is the same claim with the terms a reader would search for.
--
-- Everything else in search_content is byte-for-byte the definition from
-- 20260922130000_search_profile.sql.
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
            || setweight(to_tsvector('english', array_to_string(coalesce(e.highlights, '{}'), ' ')), 'C')
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

-- ------------------------------------------------------------
-- 2. The two points, in their own vocabulary
-- ------------------------------------------------------------
-- Subscripts, not a rewritten array: 20260924090000 set the order, and
-- assigning the same value twice is a no-op.
UPDATE public.experience
SET highlights[2] = 'Metadata-driven configuration: business rules moved out of the code and into data, as dynamic enums, database-backed lookup tables and configurable rule engines. Changing a rule no longer means editing hardcoded logic in several modules.',
    highlights[7] = 'Proof-of-concept implementations for 3+ upcoming features, built to test technical feasibility before the sprint committed to them, while backing out was still cheap.',
    updated_at    = NOW()
WHERE company = 'Tata Consultancy Services'
  AND role    = 'Backend Developer'
  AND is_deleted = FALSE;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   set role anon;
--   select q, (select string_agg(kind || ':' || title, ' | ') from search_content(q))
--   from (values ('rule engine'), ('metadata driven configuration'),
--                ('proof of concept feasibility'), ('injection flaws'),
--                ('false positives')) v(q);
--   -> every row returns the TCS role whose highlights contain it.
