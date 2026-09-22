-- ============================================================
-- V3 step 6: Explain-this, People asked, and a block of questions (ADR-053)
--
-- 1. explain_source(table, id) - one block, by name and id, for "Explain
--    this": a project section, a case-study section, a note's block, or a
--    page section. SECURITY INVOKER: the same RLS that shows the block on
--    the page decides whether it can be explained. Returns a version (a hash
--    of the text) so the ledger's cache key changes when the block does.
--
-- 2. ask_begin(): a featured row is a cache hit at any age - it is the
--    owner's published answer, and "People asked" hands it back for free.
--
-- 3. featured_qa - a view over the ledger exposing only what the owner
--    marked featured, and only the public columns. The view runs as its
--    owner (the table's RLS is not the boundary here; the WHERE is), and the
--    anon role may read it. The page reads it through the Data Cache under
--    table:featured_qa; flipping `featured` fires the revalidation trigger
--    with that name, so notify_revalidate() learns to take the tag from its
--    argument.
--
-- 4. post_blocks may be a `qa` block: { questions: [...] } - three questions
--    a note invites, rendered as chips and offered by the palette.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. explain_source
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.explain_source(p_table TEXT, p_id UUID)
RETURNS TABLE (kind TEXT, title TEXT, href TEXT, body TEXT, version TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH one AS (
    SELECT 'project section'::text AS kind,
           coalesce(ps.title, ps.type) AS title,
           '/projects/' || p.slug AS href,
           concat_ws(E'\n', ps.title, jsonb_strings(ps.content)) AS body
    FROM project_sections ps JOIN projects p ON p.id = ps.project_id
    WHERE p_table = 'project_sections' AND ps.id = p_id
    UNION ALL
    SELECT 'case study', coalesce(st.title, replace(st.section_type, '_', ' ')), '/projects/' || p.slug,
           concat_ws(E'\n', st.title, st.body)
    FROM project_storytelling st JOIN projects p ON p.id = st.project_id
    WHERE p_table = 'project_storytelling' AND st.id = p_id
    UNION ALL
    SELECT 'note block', coalesce(b.heading, po.title), '/writing/' || po.slug,
           concat_ws(E'\n', b.heading, jsonb_strings(b.config))
    FROM post_blocks b JOIN posts po ON po.id = b.post_id
    WHERE p_table = 'post_blocks' AND b.id = p_id
    UNION ALL
    SELECT 'page section', coalesce(sec.heading, sec.section_type),
           CASE sec.page WHEN 'landing' THEN '/' WHEN 'about' THEN '/about' ELSE '/how-it-works' END,
           concat_ws(E'\n', sec.heading, jsonb_strings(sec.config))
    FROM page_sections sec
    WHERE p_table = 'page_sections' AND sec.id = p_id AND sec.is_visible
  )
  SELECT o.kind, o.title, o.href, left(o.body, 4000), md5(o.body)
  FROM one o
  WHERE btrim(coalesce(o.body, '')) <> ''
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.explain_source(TEXT, UUID) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 2. ask_begin: featured rows are cache hits at any age
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ask_begin(
  p_ip_hash         TEXT,
  p_question        TEXT,
  p_question_norm   TEXT,
  p_cap_cents       INTEGER DEFAULT 300,
  p_per_ip_hour     INTEGER DEFAULT 10,
  p_cache_days      INTEGER DEFAULT 7,
  p_feature         TEXT    DEFAULT 'ask',
  p_context_href    TEXT    DEFAULT NULL,
  p_daily_cap_cents INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hit         RECORD;
  recent      INTEGER;
  spent_micro BIGINT;
  new_id      UUID;
BEGIN
  -- 1. A question already answered recently, on the same surface and for
  --    the same page context, costs nothing and counts for nothing.
  SELECT answer, citations INTO hit
  FROM ask_log
  WHERE question_norm = p_question_norm
    AND feature = p_feature
    AND coalesce(context_href, '') = coalesce(p_context_href, '')
    AND status = 'answered'
    -- A featured row is the owner's published answer: served at any age.
    AND (featured OR asked_at > NOW() - make_interval(days => GREATEST(0, p_cache_days)))
  ORDER BY featured DESC, asked_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('cached', true, 'answer', hit.answer, 'citations', hit.citations);
  END IF;

  -- 2. Per-address limit, all features together; pending rows count too.
  IF p_ip_hash IS NOT NULL AND p_ip_hash <> '' THEN
    SELECT COUNT(*) INTO recent
    FROM ask_log
    WHERE ip_hash = p_ip_hash AND asked_at > NOW() - INTERVAL '1 hour';
    IF recent >= p_per_ip_hour THEN
      RAISE EXCEPTION 'ask_rate_limited' USING ERRCODE = 'check_violation',
        DETAIL = format('%s questions in the last hour from this address', recent);
    END IF;
  END IF;

  -- 3. Daily cap (UTC day) across all features, then the calendar month.
  SELECT coalesce(SUM(cost_micro_usd), 0) INTO spent_micro
  FROM ask_log WHERE asked_at >= date_trunc('day', NOW());
  IF spent_micro >= p_daily_cap_cents::BIGINT * 10000 THEN
    RAISE EXCEPTION 'ask_budget_exhausted' USING ERRCODE = 'check_violation',
      DETAIL = format('daily: %s of %s cents', spent_micro / 10000, p_daily_cap_cents);
  END IF;
  SELECT coalesce(SUM(cost_micro_usd), 0) INTO spent_micro
  FROM ask_log WHERE asked_at >= date_trunc('month', NOW());
  IF spent_micro >= p_cap_cents::BIGINT * 10000 THEN
    RAISE EXCEPTION 'ask_budget_exhausted' USING ERRCODE = 'check_violation',
      DETAIL = format('monthly: %s of %s cents', spent_micro / 10000, p_cap_cents);
  END IF;

  INSERT INTO ask_log (ip_hash, question, question_norm, feature, context_href)
  VALUES (nullif(p_ip_hash, ''), p_question, p_question_norm, p_feature, p_context_href)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('cached', false, 'id', new_id);
END;
$$;


-- ------------------------------------------------------------
-- 3. featured_qa
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.featured_qa AS
  SELECT id, question, answer, citations, context_href, answered_at
  FROM public.ask_log
  WHERE featured AND status = 'answered' AND answer IS NOT NULL AND question IS NOT NULL;
GRANT SELECT ON public.featured_qa TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_revalidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret TEXT;
  target TEXT;
  -- The tag to expire: the table by default, or the name the trigger was
  -- created with (a view over the table, whose readers cache under its name).
  tag    TEXT := coalesce(nullif(TG_ARGV[0], ''), TG_TABLE_NAME);
BEGIN
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'revalidate_secret' LIMIT 1;
  IF secret IS NULL OR secret = '' THEN
    RAISE WARNING '[revalidate] vault secret "revalidate_secret" is not set; % on %.% not propagated',
      TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO target FROM vault.decrypted_secrets WHERE name = 'revalidate_url' LIMIT 1;
  target := coalesce(nullif(target, ''), 'https://backend-driven-portfolio.vercel.app/api/revalidate');

  BEGIN
    PERFORM net.http_post(
      url                  := target,
      body                 := jsonb_build_object('type', TG_OP, 'table', tag, 'schema', TG_TABLE_SCHEMA),
      params               := '{}'::jsonb,
      headers              := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- The write has already happened; a failed notification is a stale
    -- cache for up to an hour, not a failed edit.
    RAISE WARNING '[revalidate] http_post failed for % on %: %', TG_OP, TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_revalidate() FROM PUBLIC, anon, authenticated;

-- Only the owner's curation fires it: ask_finish sets status and answer, the
-- retention job blanks questions - neither touches `featured`.
DROP TRIGGER IF EXISTS revalidate_featured_qa ON public.ask_log;
CREATE TRIGGER revalidate_featured_qa
  AFTER UPDATE OF featured ON public.ask_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_revalidate('featured_qa');


-- ------------------------------------------------------------
-- 4. post_blocks may be a qa block
-- ------------------------------------------------------------
ALTER TABLE public.post_blocks DROP CONSTRAINT IF EXISTS post_blocks_block_type_check;
ALTER TABLE public.post_blocks ADD CONSTRAINT post_blocks_block_type_check
  CHECK (block_type IN ('prose', 'code', 'diagram', 'steps', 'table', 'qa'));


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   set role anon;
--   select kind, title, href, version from explain_source('post_blocks', '<id of a published post block>');   -- one row
--   select count(*) from explain_source('post_blocks', '<id of a draft post block>');                        -- 0
--   select count(*) from explain_source('ask_log', '<any uuid>');                                            -- 0
--   select * from featured_qa;                                                                                -- only featured rows
--   select count(*) from ask_log;                                                                             -- permission denied
--   reset role; update ask_log set featured = true where id = '<answered row>';                              -- fires revalidate('featured_qa')
