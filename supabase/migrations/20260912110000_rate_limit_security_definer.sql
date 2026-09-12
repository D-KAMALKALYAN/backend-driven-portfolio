-- ============================================================
-- rate_limit_security_definer
--
-- 20260912100000 restored the contact-form rate limit and it passed local
-- testing - as the postgres superuser. On production, verified from outside
-- with the anon key, four consecutive messages from one email all returned
-- 201. The trigger existed; it just never fired.
--
-- Cause: a trigger function runs with the privileges of the caller unless it
-- is SECURITY DEFINER. The caller is `anon`, and anon has an INSERT policy on
-- contact_messages but no SELECT policy. So inside the trigger,
--   SELECT COUNT(*) FROM contact_messages WHERE email = NEW.email ...
-- is filtered by RLS to the rows anon may see - which is none. recent_count
-- was always 0, and 0 < 3 every time.
--
-- The superuser test could not catch this because superusers bypass RLS.
-- Reproduced locally with `SET ROLE anon` before writing this fix, and the
-- same check is now the required test for any trigger that reads a table.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Contact rate limit - must see rows the caller cannot
-- ------------------------------------------------------------
-- SECURITY DEFINER runs the function as its owner, so the COUNT sees every
-- row regardless of the caller's RLS. Nothing is returned to the caller
-- except accept/reject, so no data is exposed. search_path is pinned, which
-- is required practice for SECURITY DEFINER functions: otherwise a caller
-- who can create objects in an earlier schema could shadow `contact_messages`.

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

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- 2. Analytics rate limit - same shape, for the same reason
-- ------------------------------------------------------------
-- anon does have a SELECT policy on analytics today, so this one happened
-- to work. It should not depend on that: if the read policy is ever
-- tightened (it should be - see backend-analysis.md), the limit would
-- silently stop working exactly as the contact one did.

CREATE OR REPLACE FUNCTION public.check_analytics_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF recent_count >= 100 THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- 3. Remove the verification rows the broken limit admitted
-- ------------------------------------------------------------
DELETE FROM public.contact_messages
WHERE email = 'ratelimit-probe@example.invalid';


-- ------------------------------------------------------------
-- 4. POST-CHECK - as the anon role, not as postgres
-- ------------------------------------------------------------
--   SET ROLE anon;
--   INSERT INTO contact_messages (name,email,message) VALUES ('Probe 1','x@test.invalid','probe message number one');
--   INSERT INTO contact_messages (name,email,message) VALUES ('Probe 2','x@test.invalid','probe message number two');
--   INSERT INTO contact_messages (name,email,message) VALUES ('Probe 3','x@test.invalid','probe message number three');
--   INSERT INTO contact_messages (name,email,message) VALUES ('Probe 4','x@test.invalid','probe message number four');
--   -- expect the fourth to raise "Rate limit exceeded"
--   RESET ROLE;
--   DELETE FROM contact_messages WHERE email = 'x@test.invalid';
