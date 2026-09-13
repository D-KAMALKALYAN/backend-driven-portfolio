-- ============================================================
-- ip_rate_limits_and_dead_config
--
-- 1. Rate limits keyed on the IP address.
--    Until ADR-033, ip_address was always NULL - the browser wrote the row
--    and cannot honestly know its own public IP. Both limits therefore keyed
--    on values the client chose (session_id, email) and a deliberate caller
--    could rotate them freely. Writes now arrive through the server with the
--    real address, so a second limit per IP is possible and cheap.
--
--    Thresholds are generous on purpose: one IP can be a whole office or a
--    carrier NAT. The per-IP limit is for a script, not a person.
--      analytics:        100 / session / hour (unchanged) AND 600 / IP / hour
--      contact_messages: 3 / email / 24h     (unchanged) AND 10 / IP / 24h
--    Rows with a NULL ip_address (none are written any more) skip the IP check.
--
-- 2. Dead configuration (audit problem #10).
--    Five site_content rows that nothing has ever read:
--      feature.dark_mode_enabled, feature.show_analytics - duplicates of the
--        feature_flags table, which is where flags live
--      performance.note, security.note - prose no page renders
--      profile.tagline - superseded by hero.subheadline
--    about.title was also unread and is wired instead (About page label).
--    ai.suggestions / ai.welcome_message stay: they are authored content for
--    the AI assistant on the roadmap, not orphans.
--
-- Tested with `supabase db reset` and SET ROLE for both the service role
-- and anon before push (see ADR-034).
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1a. analytics: per-session (existing) + per-IP
-- ------------------------------------------------------------
-- The COUNT by IP needs its own index; idx_analytics_session_time covers
-- only the session path.
CREATE INDEX IF NOT EXISTS idx_analytics_ip_time
  ON public.analytics (ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_analytics_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Silently drop rather than error: telemetry must never surface a failure
  -- to the visitor, and the client swallows the response anyway.
  IF NEW.session_id IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_count
    FROM public.analytics
    WHERE session_id = NEW.session_id
      AND created_at > NOW() - INTERVAL '1 hour';
    IF recent_count >= 100 THEN
      RETURN NULL;
    END IF;
  END IF;

  IF NEW.ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_count
    FROM public.analytics
    WHERE ip_address = NEW.ip_address
      AND created_at > NOW() - INTERVAL '1 hour';
    IF recent_count >= 600 THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- 1b. contact_messages: per-email (existing) + per-IP
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contact_ip_time
  ON public.contact_messages (ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_contact_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF NEW.ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_count
    FROM public.contact_messages
    WHERE ip_address = NEW.ip_address
      AND created_at > NOW() - INTERVAL '24 hours';
    IF recent_count >= 10 THEN
      RAISE EXCEPTION 'Rate limit exceeded: max 10 messages per 24 hours from this address'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- 2. Dead configuration
-- ------------------------------------------------------------
DELETE FROM public.site_content
WHERE key IN (
  'feature.dark_mode_enabled',
  'feature.show_analytics',
  'performance.note',
  'security.note',
  'profile.tagline'
);


-- ------------------------------------------------------------
-- POST-CHECK (local, as the roles that actually write)
-- ------------------------------------------------------------
--   SET ROLE service_role;
--   -- 600 analytics rows from one IP in one hour: the 601st must not appear
--   INSERT INTO analytics (event, session_id, ip_address)
--     SELECT 'page_view', 'ip-probe-' || g, '198.51.100.1' FROM generate_series(1, 601) g;
--   SELECT count(*) FROM analytics WHERE ip_address = '198.51.100.1';   -- 600
--   -- 10 contact messages from one IP with different emails: the 11th raises
--   RESET ROLE;
--   SELECT key FROM site_content WHERE key LIKE 'feature.%' OR key IN ('performance.note','security.note','profile.tagline');  -- none
