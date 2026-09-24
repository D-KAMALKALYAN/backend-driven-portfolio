-- ============================================================
-- Two things the deployment could not be asked about from outside
--
-- Step 10 of the V3 blueprint wants "question retention verified, caps
-- verified from outside". The caps were already in /api/health; retention
-- was not, and neither was the invariant that had just broken the resume
-- upload (ADR-059). Both are service-role-only functions surfaced through
-- /api/health, so `npm run check:system` can assert them without a key
-- that could read the rows themselves.
--
-- 1. ask_retention_state(p_days) - how many questions the ledger still
--    holds, how many are blanked, and - the number that matters - how many
--    are older than the retention window and still hold a visitor's words.
--    Above zero means the daily cron is not doing what ADR-049 promises,
--    which until now could only be discovered by reading the table.
--
-- 2. resume_pipeline_state() - whether the upload path can still work:
--    the trigger is installed, and every NOT NULL column of `resume`
--    without a default is one handle_resume_upload() actually supplies.
--    ADR-059 was exactly this invariant broken (file_url NOT NULL, trigger
--    passing NULL), and it stayed invisible because no upload was tried for
--    weeks. Expressed against information_schema rather than as a list of
--    known columns, so it keeps its meaning when someone adds a column.
--
-- Neither function reads a question, an answer or an address. They return
-- counts, names and booleans.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ask_retention_state
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ask_retention_state(p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'retain_days',   GREATEST(1, p_days),
    'rows',          (SELECT count(*) FROM ask_log),
    'with_question', (SELECT count(*) FROM ask_log WHERE question IS NOT NULL),
    'blanked',       (SELECT count(*) FROM ask_log WHERE question IS NULL),
    'featured',      (SELECT count(*) FROM ask_log WHERE featured),
    -- The one that must stay 0. Featured rows are the owner's, kept on purpose.
    'overdue',       (SELECT count(*) FROM ask_log
                      WHERE question IS NOT NULL AND NOT featured
                        AND asked_at < NOW() - make_interval(days => GREATEST(1, p_days))),
    'oldest_question_at', (SELECT min(asked_at) FROM ask_log WHERE question IS NOT NULL AND NOT featured)
  );
$$;

REVOKE ALL ON FUNCTION public.ask_retention_state(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ask_retention_state(INTEGER) TO service_role;


-- ------------------------------------------------------------
-- 2. resume_pipeline_state
-- ------------------------------------------------------------
-- The columns handle_resume_upload() supplies a value for. file_url is not
-- among them on purpose: the trigger passes NULL and the URL is derived at
-- read time (ADR-059), so a NOT NULL on it belongs in `unsatisfied`.
CREATE OR REPLACE FUNCTION public.resume_pipeline_state()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'trigger_installed', EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_on_resume_upload' AND NOT tgisinternal
    ),
    'unsatisfied', (
      SELECT coalesce(jsonb_agg(c.column_name ORDER BY c.column_name), '[]'::jsonb)
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = 'resume'
        AND c.is_nullable  = 'NO'
        AND c.column_default IS NULL
        AND c.column_name <> ALL (ARRAY['version', 'file_name', 'storage_path', 'is_active'])
    ),
    'rows',    (SELECT count(*) FROM resume),
    'active',  (SELECT count(*) FROM resume WHERE is_active),
    'objects', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'resumes')
  );
$$;

REVOKE ALL ON FUNCTION public.resume_pipeline_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_pipeline_state() TO service_role;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   set role service_role;
--   select ask_retention_state();    -- overdue must be 0
--   select resume_pipeline_state();  -- unsatisfied must be [], active 1
--   set role anon;
--   select ask_retention_state();    -- permission denied
--   select resume_pipeline_state();  -- permission denied
