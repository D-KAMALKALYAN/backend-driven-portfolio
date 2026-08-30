-- ============================================================
-- 005_fix_is_admin_fail_open.sql
--
-- !! CRITICAL - APPLY IMMEDIATELY, BEFORE ANYTHING ELSE !!
--
-- 002 rewrote is_admin() in a way that FAILS OPEN: it currently returns
-- TRUE for every anonymous visitor, which grants full ALL access (read,
-- insert, update, delete) on every table carrying an "Admin can manage ..."
-- policy.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. THE BUG
-- ------------------------------------------------------------
-- 002 shipped:
--
--   RETURN COALESCE(auth.jwt() ->> 'email', '')
--          = COALESCE(current_setting('app.admin_email', TRUE), '');
--
-- For an anonymous request auth.jwt() is NULL, so the left side collapses
-- to ''. If app.admin_email was never set, current_setting(..., TRUE)
-- returns NULL and the right side also collapses to ''.
--
--   '' = ''  ->  TRUE
--
-- Every admin policy in the schema therefore evaluated TRUE for anon.
-- RLS permissive policies are OR-combined, so a single FOR ALL admin
-- policy silently overrode every restrictive policy on that table.
--
-- Verified against production before this fix:
--   GET /rest/v1/contact_messages   -> 206, 2 rows readable by anon
--   GET /rest/v1/activity_logs      -> 206, 1 row readable by anon
--   POST /rest/v1/contact_messages with status='replied' -> 201
--
-- This also explains why 004's tightened policies appeared to have no
-- effect: they were correct, but the admin FOR ALL policy OR'd past them.
--
-- Root cause class: COALESCE-to-empty-string turns "absent" into a value
-- that can legitimately compare equal. An authorization predicate must
-- FAIL CLOSED - if either side is unknown, the answer is no.


-- ------------------------------------------------------------
-- 2. THE FIX
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_email   TEXT;
  admin_email TEXT;
BEGIN
  -- NULLIF, not COALESCE: an absent value must stay absent.
  jwt_email   := NULLIF(auth.jwt() ->> 'email', '');
  admin_email := NULLIF(current_setting('app.admin_email', TRUE), '');

  -- Fail closed. No JWT, or no configured admin, means not an admin.
  IF jwt_email IS NULL OR admin_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN lower(jwt_email) = lower(admin_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ------------------------------------------------------------
-- 3. SET THE ADMIN EMAIL
-- ------------------------------------------------------------
-- Required, or is_admin() is FALSE for everyone and admin writes must go
-- through the Supabase dashboard (which bypasses RLS as service_role).
-- That is a safe default: closed until explicitly configured.
--
-- Run once, then reconnect for it to take effect:
--
--   ALTER DATABASE postgres SET app.admin_email = 'kamalkalyan1260@gmail.com';


-- ------------------------------------------------------------
-- 4. VERIFY THE FIX BEFORE TRUSTING IT
-- ------------------------------------------------------------
-- As the SQL editor runs as a superuser, check the anon path explicitly:
--
--   SET LOCAL ROLE anon;
--   SELECT is_admin();                      -- expect FALSE
--   SELECT count(*) FROM contact_messages;  -- expect 0
--   SELECT count(*) FROM activity_logs;     -- expect 0
--   RESET ROLE;
--
-- Then re-check from outside with the anon key:
--   curl -H "apikey: <anon>" ".../rest/v1/contact_messages?select=id"
--     -> expect an empty array


-- ------------------------------------------------------------
-- 5. REMOVE THE PROBE ROW ADMITTED BY THE BUG
-- ------------------------------------------------------------
DELETE FROM contact_messages
WHERE name = 'ZZ_probe_delete_me'
   OR email IN ('probe@example.invalid', 'probe@example.com');


-- ------------------------------------------------------------
-- 6. EXPOSURE WINDOW
-- ------------------------------------------------------------
-- Anonymous ALL access existed from when 002 was applied until this file
-- is run. During that window any caller holding the anon key (which ships
-- in the public JS bundle) could read contact_messages and activity_logs,
-- and could insert, update or delete any content row.
--
-- The window is short and traffic is low, but it should be treated as a
-- real exposure rather than assumed harmless:
--
--   -- Anything modified unexpectedly?
--   SELECT 'projects' AS t, id::text, updated_at FROM projects
--     WHERE updated_at > NOW() - INTERVAL '2 days'
--   UNION ALL SELECT 'site_content', id::text, updated_at FROM site_content
--     WHERE updated_at > NOW() - INTERVAL '2 days'
--   UNION ALL SELECT 'skills', id::text, updated_at FROM skills
--     WHERE updated_at > NOW() - INTERVAL '2 days'
--   ORDER BY updated_at DESC;
--
--   -- Contact submissions are the sensitive data; confirm the list is
--   -- what you expect and that nothing was deleted.
--   SELECT id, name, email, status, created_at
--   FROM contact_messages ORDER BY created_at DESC;
--
-- The anon key does not need rotating: it is public by design and was not
-- leaked by this bug. The defect was the authorization predicate, not the
-- credential.
