-- ============================================================
-- 004_fix_policy_gaps.sql
-- Corrects two gaps found by probing the live database AFTER 002/003
-- were applied, and removes verification rows those probes created.
--
-- SAFE TO RE-RUN.
--
-- Why this exists: 003 used `DROP POLICY IF EXISTS "<assumed name>"` and
-- then created a replacement. Where the deployed policy had a DIFFERENT
-- name, the DROP was a no-op and the CREATE simply ADDED a policy.
-- RLS permissive policies are OR-combined, so adding one makes the table
-- MORE permissive, not less. Verified: an anonymous insert into
-- contact_messages with status='replied' returned 201 despite the new
-- policy requiring status='unread'.
--
-- Lesson encoded below: never DROP a policy by an assumed name. Enumerate
-- pg_policies and drop whatever is actually there.
-- ============================================================


-- ------------------------------------------------------------
-- 0. DIAGNOSTIC - run this first and read the output
-- ------------------------------------------------------------
-- Shows every policy currently on the affected tables, so the state is
-- visible rather than assumed.
--
--   SELECT schemaname, tablename, policyname, cmd, permissive, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('contact_messages','resume','analytics')
--   ORDER BY tablename, cmd, policyname;


-- ------------------------------------------------------------
-- 1. CONTACT_MESSAGES: exactly one INSERT policy
-- ------------------------------------------------------------
-- Drop every existing INSERT policy by enumeration, then create one.

-- Drop EVERY policy on the table, then declare the full intended set.
-- Enumerating is the point: dropping by an assumed name is what failed.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contact_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contact_messages', pol.policyname);
    RAISE NOTICE 'dropped contact_messages policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY "Admin can manage contact messages"
  ON contact_messages FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Public can submit contact message"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 2 AND 100
    AND char_length(message) BETWEEN 10 AND 5000
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND status = 'unread'
  );


-- ------------------------------------------------------------
-- 2. RESUME: only the active resume is publicly readable
-- ------------------------------------------------------------
-- Probing after 002/003 showed all 5 rows readable by anon, including 4
-- inactive ones. Before the migrations only 1 was visible, so a SELECT
-- policy on `resume` changed or was duplicated. Same enumeration fix.
--
-- This matters: inactive rows expose the storage_path of every superseded
-- resume, which is the same information leak as bucket enumeration
-- (security-analysis.md MEDIUM-1) reached by a different route.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'resume'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.resume', pol.policyname);
    RAISE NOTICE 'dropped resume policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY "Public can read active resume"
  ON resume FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY "Admin can manage resume"
  ON resume FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ------------------------------------------------------------
-- 3. ANALYTICS: exactly one INSERT policy
-- ------------------------------------------------------------
-- Same failure mode is possible here; 003 created
-- "Anyone can insert analytics" over a policy of the same name, so it
-- probably replaced cleanly - but verify rather than assume.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analytics'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics', pol.policyname);
    RAISE NOTICE 'dropped analytics policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY "Public can insert analytics"
  ON analytics FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event IS NOT NULL
    AND (meta IS NULL OR jsonb_typeof(meta) = 'object')
  );

-- The /analytics dashboard reads recent events with the anon key, so a
-- public SELECT policy is required and was previously implied by whatever
-- policy set existed. Declared explicitly here.
CREATE POLICY "Public can read analytics"
  ON analytics FOR SELECT
  TO anon, authenticated
  USING (TRUE);


-- ------------------------------------------------------------
-- 4. REMOVE VERIFICATION ROWS
-- ------------------------------------------------------------
-- Written by constraint probes against production during verification.
-- Narrowly targeted so no genuine data can match.

DELETE FROM contact_messages
WHERE email = 'probe@example.invalid'
   OR (email = 'probe@example.com' AND name = 'Probe')
   OR name  = 'ZZ_probe_delete_me';

DELETE FROM analytics
WHERE path = '/__verify'
   OR meta ->> 'event_key' LIKE 'verify_probe_%';


-- ------------------------------------------------------------
-- 5. DATA HYGIENE: a malformed resume version
-- ------------------------------------------------------------
-- One row has version '2026-06-10-1414\n' - a trailing newline, from a
-- hand-entered value. It duplicates the row above it in every other
-- respect and would have collided under the old minute-precision
-- ON CONFLICT (version) key.

-- Remove an INACTIVE row that duplicates another row's storage_path,
-- keeping the earliest. Never touches the active resume.
DELETE FROM resume r
WHERE r.is_active = FALSE
  AND EXISTS (
    SELECT 1 FROM resume k
    WHERE k.id <> r.id
      AND k.storage_path = r.storage_path
      AND (k.created_at < r.created_at
           OR (k.created_at = r.created_at AND k.id < r.id))
  );

-- Then normalise any remaining whitespace in version strings.
UPDATE resume SET version = btrim(version) WHERE version <> btrim(version);


-- ------------------------------------------------------------
-- 6. POST-CHECK
-- ------------------------------------------------------------
-- Expect: contact_messages 1 INSERT policy, resume 1 SELECT policy,
-- analytics 1 INSERT policy.
--
--   SELECT tablename, cmd, count(*) AS policies
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('contact_messages','resume','analytics')
--   GROUP BY 1,2 ORDER BY 1,2;
