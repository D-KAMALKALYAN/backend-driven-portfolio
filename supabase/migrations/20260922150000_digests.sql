-- ============================================================
-- V3 step 7: the daily digest (ADR-054, blueprint 3.4)
--
-- One row a day, written by the cron after the rollup: three sentences
-- about the site's analytics, from the numbers alone. The analytics are
-- already public (/api/analytics), so the digest is too: anon may read,
-- only the service role writes (no INSERT policy; the service role bypasses
-- RLS). One digest per kind and day. The revalidation trigger keeps the
-- cached read fresh the moment a row lands.
--
-- SAFE TO RE-RUN.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.digests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start   DATE NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'daily' CHECK (kind IN ('daily', 'weekly')),
  body           TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 1200),
  model          TEXT,
  cost_micro_usd INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, period_start)
);
CREATE INDEX IF NOT EXISTS idx_digests_kind_period ON public.digests (kind, period_start DESC);

ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read digests" ON public.digests;
CREATE POLICY "Public can read digests" ON public.digests FOR SELECT TO PUBLIC USING (true);
GRANT SELECT ON public.digests TO anon, authenticated;
GRANT ALL ON public.digests TO service_role;

DROP TRIGGER IF EXISTS revalidate_digests ON public.digests;
CREATE TRIGGER revalidate_digests
  AFTER INSERT OR UPDATE OR DELETE ON public.digests
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_revalidate();

-- POST-CHECK
--   set role anon; select count(*) from digests;                                  -- allowed
--   insert into digests (period_start, body) values (current_date, 'x');           -- denied (RLS, no policy)
--   reset role; set role service_role; insert ... ;                                 -- allowed, fires revalidate('digests')
