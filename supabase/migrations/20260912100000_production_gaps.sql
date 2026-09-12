-- ============================================================
-- production_gaps
--
-- The first migration written on top of a real baseline. 20260912091438
-- was pulled from production with `supabase db pull`, and `db reset` from it
-- reproduces production exactly. That made it possible to diff what the
-- hand-written migrations (now in supabase/migrations-archive/) CLAIMED to
-- create against what production actually has. Four gaps:
--
--   1. No updated_at triggers. Every table has the column; nothing
--      maintains it, so updated_at is really created_at with a misleading
--      name.
--   2. No rate-limit triggers on contact_messages or analytics. The audit
--      assumed both existed from 001. They were never applied.
--   3. trg_single_active_resume is still present. The DROP was added to 002
--      after 002 had already been run, so production never received it. The
--      partial unique index one_active_resume already enforces the invariant
--      declaratively; the trigger's silent-mutation behaviour is what ADR-009
--      set out to remove.
--   4. Three indexes from 001 were never created.
--
-- SAFE TO RE-RUN. Tested with `supabase db reset` before being handed over.
-- ============================================================


-- ------------------------------------------------------------
-- 1. updated_at - maintain the column that every table already has
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'projects', 'project_sections', 'skills', 'experience',
    'achievements', 'resume', 'site_content', 'feature_flags', 'external_profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_update_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_update_%I_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      t, t
    );
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- 2. Rate limits - defence in depth, honestly labelled
-- ------------------------------------------------------------
-- Both key on a value the client supplies (email, session_id), so both are
-- bypassable by a deliberate attacker who rotates it. They still stop naive
-- abuse, cost nothing, and the write path moving behind a server route (with
-- a real IP to key on) is the durable answer - see backend-analysis.md.

-- 2a. contact_messages: 3 per email per 24h
CREATE OR REPLACE FUNCTION public.check_contact_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.contact_messages
  WHERE email = NEW.email
    AND created_at > NOW() - INTERVAL '24 hours';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 3 messages per 24 hours'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_rate_limit ON public.contact_messages;
CREATE TRIGGER trg_contact_rate_limit
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_contact_rate_limit();

-- 2b. analytics: 100 events per session per hour.
-- idx_analytics_session_time (session_id, created_at DESC) already exists in
-- production, so this COUNT is an index range scan, not a table scan.
CREATE OR REPLACE FUNCTION public.check_analytics_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.analytics
  WHERE session_id = NEW.session_id
    AND created_at > NOW() - INTERVAL '1 hour';

  -- Silently drop rather than error: telemetry must never surface a failure
  -- to the visitor, and the client swallows the response anyway.
  IF recent_count >= 100 THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_rate_limit ON public.analytics;
CREATE TRIGGER trg_analytics_rate_limit
  BEFORE INSERT ON public.analytics
  FOR EACH ROW EXECUTE FUNCTION public.check_analytics_rate_limit();


-- ------------------------------------------------------------
-- 3. Retire the resume trigger the unique index replaces (ADR-009)
-- ------------------------------------------------------------
-- one_active_resume (UNIQUE ON resume (is_active) WHERE is_active) is
-- present in production. With it, activating a second resume fails loudly
-- and the caller must deactivate the current one explicitly - which is the
-- point. The trigger instead silently rewrote other rows with no record.
DROP TRIGGER IF EXISTS trg_single_active_resume ON public.resume;
DROP FUNCTION IF EXISTS public.enforce_single_active_resume();


-- ------------------------------------------------------------
-- 4. Indexes from 001 that were never created
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_experience_start_date ON public.experience (start_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_views        ON public.projects (view_count DESC);
-- idx_experience_is_current is deliberately NOT recreated: a boolean with two
-- rows has no selectivity worth an index.


-- ------------------------------------------------------------
-- 5. POST-CHECK
-- ------------------------------------------------------------
--   SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_%' ORDER BY 1;
--   -- expect: trg_analytics_rate_limit, trg_contact_rate_limit,
--   --         trg_handle_analytics, trg_on_resume_upload, and ten
--   --         trg_update_*_updated_at. NOT trg_single_active_resume.
--
--   UPDATE skills SET proficiency = proficiency WHERE name = 'Java'
--   RETURNING updated_at > created_at;   -- expect true
