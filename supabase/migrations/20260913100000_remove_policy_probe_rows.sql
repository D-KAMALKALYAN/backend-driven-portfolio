-- ============================================================
-- remove_policy_probe_rows
--
-- 20260913090000 dropped the anon INSERT policies. Verified from outside
-- immediately after: direct anon INSERT on analytics and contact_messages
-- refused with 42501; anon SELECT on analytics still 200; the site's own
-- writes via the service role still 204 (/api/track) and 201 (/api/contact),
-- the tracked row carrying ip_address and country. This removes the rows
-- those checks wrote, plus the earlier /track-probe rows from local testing.
--
-- SAFE TO RE-RUN.
-- ============================================================

DELETE FROM public.contact_messages
WHERE email = 'policy-probe@example.invalid';

DELETE FROM public.analytics
WHERE path IN ('/policy-probe', '/track-probe');
