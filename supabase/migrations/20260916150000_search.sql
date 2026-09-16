-- ============================================================
-- search
--
-- Roadmap 3.2 asked for pgvector semantic search "once there is enough to
-- search". There are five projects and three posts. An embedding pipeline
-- for eight documents is infrastructure without a problem, so this ships
-- the half that is needed now: Postgres full-text search across projects,
-- posts, skills and experience, weighted and ranked, exposed as one
-- function the command palette calls. The function's shape (kind, title,
-- snippet, href, rank) is what a hybrid semantic ranker would return too;
-- adding pgvector later changes the function body, not its callers.
--
-- Runs as the caller (SECURITY INVOKER), so RLS decides what is searchable:
-- anon never sees a draft post or a hidden project, and the function cannot
-- be used to probe for them.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. No indexes, deliberately
-- ------------------------------------------------------------
-- The obvious move is a GIN index on each table's tsvector expression. It
-- does not work as an expression index: to_tsvector(text, ...) and
-- array_to_string() are STABLE, not IMMUTABLE, so Postgres refuses
-- (42P17) - the first local replay of this file said so. The correct form
-- at scale is a stored tsvector column maintained by trigger, indexed with
-- GIN. At eight documents a sequential scan is faster than any of that, so
-- the indexes are not built and the trigger is not written. This comment
-- is the reminder for the day the volume changes.

-- ------------------------------------------------------------
-- 2. The function
-- ------------------------------------------------------------
-- Post bodies live in post_blocks as jsonb; their text is folded in at
-- weight C through a lateral aggregate, so "SECURITY DEFINER" finds the
-- post that explains it even when the title does not say so.
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

  -- websearch syntax ("a b", -c, OR) for phrases; a lone word also matches
  -- as a prefix so "post" finds "PostgreSQL" while the visitor is typing.
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
-- POST-CHECK (as anon)
-- ------------------------------------------------------------
--   SET ROLE anon;
--   SELECT kind, title, rank FROM search_content('postgres');        -- projects/skills using it
--   SELECT kind, title FROM search_content('rate limit');            -- no rows while the posts are drafts
--   SELECT count(*) FROM search_content('x');                        -- 0 (too short)
--   SELECT count(*) FROM search_content('SECURITY DEFINER');         -- 0 as anon until post 1 is published
