-- ============================================================
-- revalidate diagnostics
--
-- Twice now the question "did the revalidation trigger deliver?" could
-- not be answered from outside: the Vault is private, pg_net's responses
-- live in net._http_response, and the Postgres log is the dashboard's.
-- The health route exists precisely for "configured vs working" questions
-- (ADR-043), so this gives it something to ask.
--
-- One function, callable by the service role only, returning booleans and
-- the last pg_net response - never a secret value:
--
--   { "secret_set": true, "url_override": false, "triggers": 15,
--     "last": { "status": 200, "at": "...", "error": null } }
--
-- SAFE TO RE-RUN.
-- ============================================================

CREATE OR REPLACE FUNCTION public.revalidate_diagnostics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'secret_set', EXISTS (
      SELECT 1 FROM vault.decrypted_secrets
      WHERE name = 'revalidate_secret' AND coalesce(decrypted_secret, '') <> ''
    ),
    'url_override', EXISTS (
      SELECT 1 FROM vault.decrypted_secrets
      WHERE name = 'revalidate_url' AND coalesce(decrypted_secret, '') <> ''
    ),
    'triggers', (
      SELECT count(*) FROM pg_catalog.pg_trigger
      WHERE tgname LIKE 'revalidate\_%' AND NOT tgisinternal
    ),
    -- pg_net keeps responses for a few hours (pg_net.ttl); null after that.
    'last', (
      SELECT jsonb_build_object(
        'status', r.status_code,
        'at', r.created,
        'error', r.error_msg
      )
      FROM net._http_response r
      ORDER BY r.id DESC
      LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.revalidate_diagnostics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revalidate_diagnostics() TO service_role;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   set role service_role; select revalidate_diagnostics();   -- jsonb as above
--   set role anon;         select revalidate_diagnostics();   -- permission denied
--   GET /api/health  ->  "revalidation": { "secretSet": ..., "triggers": 15, "last": {...} }
