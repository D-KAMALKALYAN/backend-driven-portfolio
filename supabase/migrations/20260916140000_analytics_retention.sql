-- ============================================================
-- analytics_retention
--
-- Roadmap 2.13. `analytics` is the only unbounded table: every page view is
-- a row forever. At today's volume that is harmless; the point of doing it
-- now is that a retention policy designed before it is needed can be tested
-- against an invariant, and one designed after it is needed is written in
-- a hurry against a table nobody wants to touch.
--
-- Design:
--   analytics_daily      one row per (day, event): events, distinct sessions,
--                        distinct visitors, and the day's paths with counts
--                        as jsonb. Aggregated data; public read like the raw
--                        table's dashboard reads.
--   rollup_analytics(n)  moves every raw row older than n days (default 90)
--                        into analytics_daily, then deletes it. Whole days
--                        only. Idempotent. Callable only by the service role,
--                        from /api/cron/rollup on a daily Vercel cron.
--   get_analytics_summary()  now adds the rolled-up days back into its
--                        all-time totals, so the dashboard's numbers do not
--                        drop when the raw rows go.
--
-- The invariant, tested before push (ADR-040): get_analytics_summary()
-- returns the same total_visits, total_project_views and unique_visitors
-- immediately before and after a rollup.
--
-- Honest caveat, recorded: "unique_visitors" (labelled Sessions in the UI)
-- becomes a sum of per-day distinct sessions for the rolled-up period. A
-- session that spans midnight is counted twice there. Sessions are per-tab
-- and short; the error is small and one-directional, and it is written
-- down here rather than hidden.
--
-- Everything the dashboard shows for the last 30 days (analytics_daily_visits,
-- the recent feed, realtime) still reads raw rows, which retention keeps.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The rollup table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_daily (
  day       DATE    NOT NULL,
  event     TEXT    NOT NULL,
  events    INTEGER NOT NULL DEFAULT 0 CHECK (events >= 0),
  sessions  INTEGER NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  visitors  INTEGER NOT NULL DEFAULT 0 CHECK (visitors >= 0),
  -- { "/about": 12, "/projects/x": 3, ... } - the day's paths for this event
  paths     JSONB   NOT NULL DEFAULT '{}',
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day, event)
);

ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read analytics rollups" ON public.analytics_daily;
CREATE POLICY "Public can read analytics rollups" ON public.analytics_daily
  FOR SELECT TO anon, authenticated USING (true);


-- ------------------------------------------------------------
-- 2. The rollup function
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rollup_analytics(retain_days INTEGER DEFAULT 90)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff       DATE;
  days_rolled  INTEGER;
  rows_deleted BIGINT;
BEGIN
  IF retain_days < 30 THEN
    RAISE EXCEPTION 'retain_days must be at least 30 (the dashboard reads 30 days of raw rows)';
  END IF;
  cutoff := CURRENT_DATE - retain_days;

  -- Aggregate every whole day before the cutoff. ON CONFLICT handles a
  -- re-run that finds rows for a day already rolled (e.g. a previous run
  -- interrupted between INSERT and DELETE): counts add, path maps merge by
  -- adding, distinct counts take the larger - the only merge that is not
  -- an undercount without the raw rows.
  WITH src AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS day,
      event,
      COUNT(*)::int                                        AS events,
      COUNT(DISTINCT session_id)::int                      AS sessions,
      COUNT(DISTINCT meta ->> 'visitor_id')::int           AS visitors,
      COALESCE(
        jsonb_object_agg(path, cnt) FILTER (WHERE path IS NOT NULL),
        '{}'::jsonb
      )                                                     AS paths
    FROM (
      SELECT a.*, COUNT(*) OVER (PARTITION BY (a.created_at AT TIME ZONE 'UTC')::date, a.event, a.path) AS cnt
      FROM public.analytics a
      WHERE (a.created_at AT TIME ZONE 'UTC')::date < cutoff
    ) x
    GROUP BY 1, 2
  ),
  ins AS (
    INSERT INTO public.analytics_daily AS d (day, event, events, sessions, visitors, paths)
    SELECT day, event, events, sessions, visitors, paths FROM src
    ON CONFLICT (day, event) DO UPDATE SET
      events   = d.events + EXCLUDED.events,
      sessions = GREATEST(d.sessions, EXCLUDED.sessions),
      visitors = GREATEST(d.visitors, EXCLUDED.visitors),
      paths    = (
        SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
        FROM (
          SELECT k, SUM(v::int) AS v
          FROM (
            SELECT key AS k, value::text AS v FROM jsonb_each(d.paths)
            UNION ALL
            SELECT key, value::text FROM jsonb_each(EXCLUDED.paths)
          ) u
          GROUP BY k
        ) m
      ),
      rolled_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO days_rolled FROM ins;

  DELETE FROM public.analytics
  WHERE (created_at AT TIME ZONE 'UTC')::date < cutoff;
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  RETURN json_build_object(
    'cutoff', cutoff,
    'days_rolled', days_rolled,
    'rows_deleted', rows_deleted
  );
END;
$$;

-- Destructive by design; only the service role (via the cron route) may call it.
REVOKE ALL ON FUNCTION public.rollup_analytics(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_analytics(INTEGER) TO service_role;


-- ------------------------------------------------------------
-- 3. The summary adds the rolled-up days back
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_analytics_summary()
  RETURNS json
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $function$
  SELECT json_build_object(
    'total_visits',
      (SELECT COUNT(*) FROM analytics WHERE event = 'page_view')
      + (SELECT COALESCE(SUM(events), 0) FROM analytics_daily WHERE event = 'page_view'),
    -- Raw distinct sessions plus per-day distinct sessions for rolled days.
    -- See the header: a session spanning midnight in the rolled period
    -- counts twice. Labelled "Sessions" in the UI, not "people".
    'unique_visitors',
      (SELECT COUNT(DISTINCT session_id) FROM analytics WHERE event = 'page_view')
      + (SELECT COALESCE(SUM(sessions), 0) FROM analytics_daily WHERE event = 'page_view'),
    'total_project_views',
      (SELECT COUNT(*) FROM analytics WHERE event = 'project_view')
      + (SELECT COALESCE(SUM(events), 0) FROM analytics_daily WHERE event = 'project_view'),
    -- Today and this week are always inside the retention window: raw only.
    'visits_today',
      (SELECT COUNT(*) FROM analytics
        WHERE event = 'page_view'
          AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE),
    'visits_this_week',
      (SELECT COUNT(*) FROM analytics
        WHERE event = 'page_view'
          AND created_at >= DATE_TRUNC('week', NOW()))
  );
$function$;


-- ------------------------------------------------------------
-- POST-CHECK (local; the invariant)
-- ------------------------------------------------------------
--   -- seed raw rows 100 and 200 days old, then:
--   SELECT get_analytics_summary();          -- note total_visits, total_project_views, unique_visitors
--   SELECT rollup_analytics(90);             -- days_rolled > 0, rows_deleted > 0
--   SELECT get_analytics_summary();          -- identical totals
--   SET ROLE anon; SELECT rollup_analytics(90);   -- permission denied
