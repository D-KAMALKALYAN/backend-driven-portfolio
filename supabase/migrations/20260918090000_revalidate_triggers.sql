-- ============================================================
-- revalidate triggers
--
-- Content reads are cached on the server for an hour, and POST
-- /api/revalidate expires one table's cache tag early. The Supabase
-- dashboard can wire a "Database Webhook" to that route, one table per
-- hook, with the bearer secret typed into a header field. Fifteen content
-- tables, fifteen hooks by hand, none of it in the repo: the first one was
-- created on `posts` alone, and an edit to now_entries then sat stale for
-- an hour (ADR-045).
--
-- This file is the same mechanism as a migration. One trigger function,
-- attached to every content table, posts the standard webhook payload
-- ({type, table, schema}) to the route. The secret is not in this file: it
-- is read at call time from Supabase Vault, where the owner puts it once -
--
--   select vault.create_secret('<REVALIDATE_SECRET>', 'revalidate_secret');
--
-- and, optionally, a different target than production:
--
--   select vault.create_secret('http://host.docker.internal:3000/api/revalidate', 'revalidate_url');
--
-- Until the secret exists the trigger logs a WARNING and does nothing; a
-- content write is never blocked by this, and never blocked by the HTTP
-- call either (pg_net is asynchronous, and the call is wrapped).
--
-- Statement-level: one request per statement, not one per row.
--
-- SAFE TO RE-RUN.
-- ============================================================

-- Already enabled on production by the dashboard's webhook feature;
-- installs on a local replay.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ------------------------------------------------------------
-- 1. The trigger function
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_revalidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret TEXT;
  target TEXT;
BEGIN
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'revalidate_secret' LIMIT 1;
  IF secret IS NULL OR secret = '' THEN
    RAISE WARNING '[revalidate] vault secret "revalidate_secret" is not set; % on %.% not propagated',
      TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO target FROM vault.decrypted_secrets WHERE name = 'revalidate_url' LIMIT 1;
  target := coalesce(nullif(target, ''), 'https://backend-driven-portfolio.vercel.app/api/revalidate');

  BEGIN
    PERFORM net.http_post(
      url                  := target,
      body                 := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA),
      params               := '{}'::jsonb,
      headers              := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- The write has already happened; a failed notification is a stale
    -- cache for up to an hour, not a failed edit.
    RAISE WARNING '[revalidate] http_post failed for % on %: %', TG_OP, TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- Fires as its owner (to read the vault); nothing else may call it.
REVOKE ALL ON FUNCTION public.notify_revalidate() FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- 2. One trigger per content table (the tables the server caches)
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'site_content', 'profiles', 'projects', 'project_sections', 'project_storytelling',
    'skills', 'experience', 'achievements', 'external_profiles', 'resume',
    'page_sections', 'now_entries', 'ventures', 'posts', 'post_blocks'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE WARNING '[revalidate] table public.% does not exist; skipped', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS revalidate_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER revalidate_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.notify_revalidate()',
      t, t);
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- 3. Retire the dashboard-made hook on posts
-- ------------------------------------------------------------
-- The dashboard implements a webhook as a trigger calling
-- supabase_functions.http_request with the secret baked into its
-- arguments. With the trigger above on the same table it would fire twice
-- per edit - harmless, but two mechanisms for one job is how one of them
-- goes stale unnoticed.
DO $$
DECLARE
  tg RECORD;
BEGIN
  FOR tg IN
    SELECT tr.tgname, c.relname
    FROM pg_trigger tr
    JOIN pg_class c      ON c.oid = tr.tgrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    JOIN pg_proc p       ON p.oid = tr.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE NOT tr.tgisinternal
      AND cn.nspname = 'public'
      AND pn.nspname = 'supabase_functions'
      AND p.proname  = 'http_request'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', tg.tgname, tg.relname);
    RAISE NOTICE '[revalidate] dropped dashboard webhook trigger % on %', tg.tgname, tg.relname;
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select count(*) from pg_trigger where tgname like 'revalidate_%';   -- 15
--   update now_entries set updated_at = now() where ...;                  -- as postgres
--   select status_code, content from net._http_response order by id desc limit 1;  -- 200, {"ok":true,"revalidated":"table:now_entries",...}
