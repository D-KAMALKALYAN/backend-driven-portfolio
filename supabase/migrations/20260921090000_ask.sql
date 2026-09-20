-- ============================================================
-- ask
--
-- Roadmap 3.3: grounded Q&A over the site's own content, with citations and
-- a spend cap (ADR-047). Two halves live here.
--
-- 1. ask_context(q, max_docs) - the retrieval. Ranks with the same full-text
--    search the palette uses (search_content, ADR-041) and returns the FULL
--    text of each hit rather than a snippet: a project with its case study,
--    a post with its blocks, a How-it-works section with its paragraphs, a
--    role with its description. SECURITY INVOKER, so the route calls it
--    with the anon key and Row Level Security decides what the model may
--    quote - a draft post cannot be cited by anyone who could not read it.
--
-- 2. ask_log + ask_begin()/ask_finish() - the ledger. Every question is a
--    row: who (a salted hash of the address, never the address), what, how
--    many tokens, what it cost. ask_begin() is the gate: it returns a cached
--    answer for a question asked recently, refuses past 10 questions per
--    address per hour, refuses past the monthly cap, and otherwise inserts
--    the pending row. Service role only - the browser never touches this
--    table. Limits are invariants, so they live here, not in the route.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Retrieval with full text
-- ------------------------------------------------------------
-- Every string value inside a block's jsonb config, space-joined: the text a
-- reader sees, without the keys. Used for post blocks and page sections.
CREATE OR REPLACE FUNCTION public.jsonb_strings(doc jsonb)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT string_agg(v #>> '{}', ' ')
  FROM jsonb_path_query(doc, 'strict $.** ? (@.type() == "string")') AS v;
$$;

CREATE OR REPLACE FUNCTION public.ask_context(q TEXT, max_docs INTEGER DEFAULT 6)
RETURNS TABLE (kind TEXT, title TEXT, href TEXT, body TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH hits AS (
    SELECT s.kind, s.title, s.href, s.snippet, s.rank
    FROM search_content(q, GREATEST(1, LEAST(coalesce(max_docs, 6), 10))) s
  ),
  -- The architecture page is not in search_content (it is a page, not a
  -- record); its prose is the best source for "how does this site work".
  pages AS (
    SELECT 'page'::text AS kind,
           ps.heading AS title,
           '/how-it-works' AS href,
           left(concat_ws(E'\n', ps.heading, jsonb_strings(ps.config)), 2500) AS body,
           ts_rank_cd(to_tsvector('english', coalesce(ps.heading, '') || ' ' || coalesce(jsonb_strings(ps.config), '')),
                      websearch_to_tsquery('english', left(btrim(coalesce(q, '')), 100)))::real AS rank
    FROM page_sections ps
    WHERE ps.page = 'how_it_works' AND ps.is_visible
      AND to_tsvector('english', coalesce(ps.heading, '') || ' ' || coalesce(jsonb_strings(ps.config), ''))
          @@ websearch_to_tsquery('english', left(btrim(coalesce(q, '')), 100))
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

GRANT EXECUTE ON FUNCTION public.jsonb_strings(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ask_context(TEXT, INTEGER) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 2. The ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ask_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash        TEXT,                                   -- salted hash; the address itself is never stored
  question       TEXT NOT NULL CHECK (char_length(question) BETWEEN 3 AND 300),
  question_norm  TEXT NOT NULL,                          -- lowercased, punctuation-stripped, for the answer cache
  answer         TEXT,
  citations      JSONB NOT NULL DEFAULT '[]',
  model          TEXT,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  cost_micro_usd INTEGER NOT NULL DEFAULT 0,             -- millionths of a dollar; integers add up exactly
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'failed')),
  answered_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ask_log_ip_time ON public.ask_log (ip_hash, asked_at DESC) WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ask_log_norm_time ON public.ask_log (question_norm, asked_at DESC) WHERE status = 'answered';
CREATE INDEX IF NOT EXISTS idx_ask_log_month ON public.ask_log (asked_at);

-- RLS on with no policies: nothing reads or writes this but the service
-- role, which bypasses RLS. Same posture as contact_messages.
ALTER TABLE public.ask_log ENABLE ROW LEVEL SECURITY;

-- The gate. Returns jsonb:
--   { "cached": true,  "answer": ..., "citations": [...] }  a recent identical question
--   { "cached": false, "id": <uuid> }                         proceed; finish with ask_finish()
-- Raises with ERRCODE check_violation and a message the route relays when
-- the address or the month is over budget.
CREATE OR REPLACE FUNCTION public.ask_begin(
  p_ip_hash        TEXT,
  p_question       TEXT,
  p_question_norm  TEXT,
  p_cap_cents      INTEGER DEFAULT 300,
  p_per_ip_hour    INTEGER DEFAULT 10,
  p_cache_days     INTEGER DEFAULT 7
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
  -- 1. A question already answered recently costs nothing and counts for nothing.
  SELECT answer, citations INTO hit
  FROM ask_log
  WHERE question_norm = p_question_norm
    AND status = 'answered'
    AND asked_at > NOW() - make_interval(days => GREATEST(0, p_cache_days))
  ORDER BY asked_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('cached', true, 'answer', hit.answer, 'citations', hit.citations);
  END IF;

  -- 2. Per-address limit: pending rows count too, or a burst slips through.
  IF p_ip_hash IS NOT NULL THEN
    SELECT COUNT(*) INTO recent
    FROM ask_log
    WHERE ip_hash = p_ip_hash AND asked_at > NOW() - INTERVAL '1 hour';
    IF recent >= p_per_ip_hour THEN
      RAISE EXCEPTION 'ask_rate_limited' USING ERRCODE = 'check_violation',
        DETAIL = format('%s questions in the last hour from this address', recent);
    END IF;
  END IF;

  -- 3. Monthly cap, calendar month, in micro-dollars.
  SELECT coalesce(SUM(cost_micro_usd), 0) INTO spent_micro
  FROM ask_log
  WHERE asked_at >= date_trunc('month', NOW());
  IF spent_micro >= p_cap_cents::BIGINT * 10000 THEN
    RAISE EXCEPTION 'ask_budget_exhausted' USING ERRCODE = 'check_violation',
      DETAIL = format('%s of %s cents spent this month', spent_micro / 10000, p_cap_cents);
  END IF;

  INSERT INTO ask_log (ip_hash, question, question_norm)
  VALUES (p_ip_hash, p_question, p_question_norm)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('cached', false, 'id', new_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ask_finish(
  p_id             UUID,
  p_status         TEXT,
  p_answer         TEXT,
  p_citations      JSONB,
  p_model          TEXT,
  p_input_tokens   INTEGER,
  p_output_tokens  INTEGER,
  p_cost_micro_usd INTEGER
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ask_log
  SET status = p_status,
      answer = p_answer,
      citations = coalesce(p_citations, '[]'::jsonb),
      model = p_model,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_micro_usd = coalesce(p_cost_micro_usd, 0),
      answered_at = NOW()
  WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.ask_begin(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ask_finish(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ask_begin(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.ask_finish(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- What this month has cost, for /api/health. Service role only.
CREATE OR REPLACE FUNCTION public.ask_spend()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'month_micro_usd', coalesce(SUM(cost_micro_usd), 0),
    'month_questions', COUNT(*) FILTER (WHERE status = 'answered'),
    'month_failed',    COUNT(*) FILTER (WHERE status = 'failed')
  )
  FROM ask_log
  WHERE asked_at >= date_trunc('month', NOW());
$$;
REVOKE ALL ON FUNCTION public.ask_spend() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ask_spend() TO service_role;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   SET ROLE anon;
--   SELECT kind, title, href, length(body) FROM ask_context('rate limit');   -- posts + project, full bodies
--   SELECT kind, title FROM ask_context('nonce CSP');                        -- includes a 'page' row
--   SELECT ask_begin('h', 'q', 'q');                                         -- permission denied
--   RESET ROLE; SET ROLE service_role;
--   SELECT ask_begin('h', 'What is this?', 'what is this');                  -- {"cached": false, "id": ...}
--   -- 10 more from 'h' -> ask_rate_limited
