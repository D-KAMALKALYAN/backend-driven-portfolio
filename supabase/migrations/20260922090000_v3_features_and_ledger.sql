-- ============================================================
-- V3 step 2: features and the Ask ledger, second shape (ADR-049)
--
-- 1. feature_flags becomes what it was named. The V1 rows (show_blog,
--    enable_hire_me_btn, show_analytics_dash, maintenance_mode) were never
--    read by this app; they go. Two rows arrive that the app does read:
--      writing - the Writing nav item and /writing (still also requires a
--                published post; an empty section hides itself)
--      ask     - the palette's Ask row and POST /api/ask (still also
--                requires OPENAI_API_KEY and the service key)
--    A flag is an owner kill-switch that needs no deploy. Its edits reach
--    the site through the same revalidation trigger the content tables use.
--
-- 2. ask_log learns what V3 needs to learn from it:
--      feature       which surface asked (ask | explain | digest ...) -
--                    cost is attributed, caps can be per feature later
--      context_href  the page the visitor was on, when the client said so
--                    and the server verified it (step 4 fills it)
--      sources       the hrefs the answer was grounded in (jsonb)
--      featured      owner-approved for public "People asked" (step 6)
--    ask_begin() gains a daily cap beside the monthly one - 10/h/address
--    across many addresses could otherwise spend a month in an afternoon -
--    and ask_retention() blanks questions older than N days: a visitor's
--    words are not kept forever; tokens, cost and hrefs are (ADR-040's
--    posture for analytics, applied here).
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. feature_flags
-- ------------------------------------------------------------
DELETE FROM public.feature_flags
WHERE key IN ('show_blog', 'enable_hire_me_btn', 'show_analytics_dash', 'maintenance_mode');

INSERT INTO public.feature_flags (key, enabled, description)
VALUES
  ('writing', TRUE, 'Writing in the navigation and /writing. Also requires at least one published post.'),
  ('ask',     TRUE, 'The palette''s Ask row and POST /api/ask. Also requires OPENAI_API_KEY on the deployment.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- The same revalidation trigger the content tables carry (ADR-045), so a
-- flipped flag is live on the next request.
DROP TRIGGER IF EXISTS revalidate_feature_flags ON public.feature_flags;
CREATE TRIGGER revalidate_feature_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_revalidate();


-- ------------------------------------------------------------
-- 2. ask_log, second shape
-- ------------------------------------------------------------
ALTER TABLE public.ask_log
  ADD COLUMN IF NOT EXISTS feature      TEXT NOT NULL DEFAULT 'ask' CHECK (feature IN ('ask', 'explain', 'digest', 'suggest')),
  ADD COLUMN IF NOT EXISTS context_href TEXT,
  ADD COLUMN IF NOT EXISTS sources      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS featured     BOOLEAN NOT NULL DEFAULT FALSE;
-- Retention blanks the question; the column must allow it.
ALTER TABLE public.ask_log ALTER COLUMN question DROP NOT NULL;
ALTER TABLE public.ask_log DROP CONSTRAINT IF EXISTS ask_log_question_check;
ALTER TABLE public.ask_log ADD CONSTRAINT ask_log_question_check
  CHECK (question IS NULL OR char_length(question) BETWEEN 3 AND 300);

CREATE INDEX IF NOT EXISTS idx_ask_log_feature_time ON public.ask_log (feature, asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ask_log_featured ON public.ask_log (featured) WHERE featured;

-- ask_begin: + feature, context, daily cap. The old 6-argument signature is
-- dropped so there is one gate, not two.
DROP FUNCTION IF EXISTS public.ask_begin(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER);
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
    AND asked_at > NOW() - make_interval(days => GREATEST(0, p_cache_days))
  ORDER BY asked_at DESC
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

-- ask_finish: + sources. Old 8-argument signature dropped.
DROP FUNCTION IF EXISTS public.ask_finish(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.ask_finish(
  p_id             UUID,
  p_status         TEXT,
  p_answer         TEXT,
  p_citations      JSONB,
  p_model          TEXT,
  p_input_tokens   INTEGER,
  p_output_tokens  INTEGER,
  p_cost_micro_usd INTEGER,
  p_sources        JSONB DEFAULT '[]'
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ask_log
  SET status = p_status,
      answer = nullif(p_answer, ''),
      citations = coalesce(p_citations, '[]'::jsonb),
      sources = coalesce(p_sources, '[]'::jsonb),
      model = p_model,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_micro_usd = coalesce(p_cost_micro_usd, 0),
      answered_at = NOW()
  WHERE id = p_id;
$$;

-- ask_spend: per feature, this month and today.
CREATE OR REPLACE FUNCTION public.ask_spend()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'month_micro_usd', coalesce(SUM(cost_micro_usd), 0),
    'today_micro_usd', coalesce(SUM(cost_micro_usd) FILTER (WHERE asked_at >= date_trunc('day', NOW())), 0),
    'month_questions', COUNT(*) FILTER (WHERE status = 'answered'),
    'month_failed',    COUNT(*) FILTER (WHERE status = 'failed'),
    'by_feature', (
      SELECT coalesce(jsonb_object_agg(f.feature, f.micro), '{}'::jsonb)
      FROM (SELECT feature, SUM(cost_micro_usd) AS micro FROM ask_log
            WHERE asked_at >= date_trunc('month', NOW()) GROUP BY feature) f
    )
  )
  FROM ask_log
  WHERE asked_at >= date_trunc('month', NOW());
$$;

-- ask_retention: a visitor's words are kept for p_days, the ledger forever.
CREATE OR REPLACE FUNCTION public.ask_retention(p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  -- Featured rows are the owner's curated "People asked" (step 6); they keep
  -- their words. The answer is the model's text over public content, not the
  -- visitor's, and stays for the owner's review.
  UPDATE ask_log
  SET question = NULL,
      question_norm = 'retired:' || encode(sha256(convert_to(question_norm, 'UTF8')), 'hex')
  WHERE asked_at < NOW() - make_interval(days => GREATEST(1, p_days))
    AND question IS NOT NULL
    AND NOT featured;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('days', p_days, 'rows_blanked', n);
END;
$$;

REVOKE ALL ON FUNCTION public.ask_begin(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ask_finish(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ask_spend() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ask_retention(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ask_begin(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.ask_finish(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.ask_spend() TO service_role;
GRANT EXECUTE ON FUNCTION public.ask_retention(INTEGER) TO service_role;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select key, enabled from feature_flags;                         -- writing, ask
--   set role service_role;
--   select ask_begin('h','What is this?','what is this', 300, 10, 7, 'ask', '/about', 50);
--   select ask_begin('h','anything','anything', 300, 10, 7, 'ask', null, 0);   -- ask_budget_exhausted (daily)
--   select ask_retention(1);                                          -- blanks non-featured rows older than a day
--   set role anon; select ask_retention(90);                          -- permission denied
