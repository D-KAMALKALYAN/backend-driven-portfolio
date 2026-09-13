-- ============================================================
-- drop_anon_insert_policies
--
-- Closes the audit's HIGH finding #3 structurally (ADR-007 → ADR-033).
--
-- Until now anyone holding the public anon key - which every visitor's
-- browser holds - could INSERT into analytics and contact_messages
-- directly, bounded only by triggers that key on values the client chose.
-- Both writes now go through server routes (/api/track, /api/contact) that
-- insert with the service role, record the real IP and country, and compute
-- the idempotency key themselves. With no client-side writer left, the
-- anon INSERT policies are dead weight with a blast radius.
--
-- PRECONDITION: SUPABASE_SERVICE_ROLE_KEY is set on the production
-- deployment. Verify with GET /api/health -> "serviceRole": true. Without it
-- both routes fall back to the anon key and this migration would break them.
--
-- Reads are untouched: the realtime feed and the analytics page still SELECT
-- as anon. The rate-limit triggers still fire for the service role (triggers
-- are not subject to RLS), so 3/address/day and 100/session/hour remain.
--
-- SAFE TO RE-RUN.
-- ============================================================

DROP POLICY IF EXISTS "Public can insert analytics" ON public.analytics;
DROP POLICY IF EXISTS "Public can submit contact message" ON public.contact_messages;

-- POST-CHECK - from outside, with the anon key:
--   curl -X POST "$SUPABASE_URL/rest/v1/analytics" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--        -H "Content-Type: application/json" -d '{"event":"page_view"}'
--   -- expect 401/403 "new row violates row-level security policy"
--   -- and POST /api/track on the site -> 204, POST /api/contact -> 201.
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('analytics','contact_messages');
--   -- expect only: Public can read analytics (SELECT), Admin can manage contact messages (ALL)
