-- ============================================================
-- 007_drop_dead_popularity_function.sql
-- Removes refresh_popular_badges(), which was never scheduled and never ran.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 1. WHY THIS IS DELETED RATHER THAN SCHEDULED
-- ------------------------------------------------------------
-- 001 shipped refresh_popular_badges(), which writes meta.is_popular onto the
-- three most-viewed projects. Its comment says "called by Edge Function cron
-- daily". No Edge Function and no cron job were ever created.
--
-- Verified before removing it: every project's meta is {}, so the badge the
-- function feeds has never appeared on the site.
--
-- The choice was to schedule it (pg_cron) or delete it. Deleted, because
-- "top three by view_count" is derived data:
--
--   * The list page already fetches every project, so the ranking is
--     computable from data in hand - no extension, no scheduler, no job to
--     monitor.
--   * A stored flag is stale between runs by definition. A derived one is
--     never wrong.
--   * `featured` already exists as the manual promotion flag, so the ability
--     to highlight a project by hand is not lost.
--
-- Now computed in src/utils/popularity.js.
--
-- The project detail page no longer shows the badge at all: popularity is a
-- ranking relative to the other projects, and that page holds one. It shows
-- the absolute view count instead, which is the honest signal there.

DROP FUNCTION IF EXISTS refresh_popular_badges();


-- ------------------------------------------------------------
-- 2. CLEAR ANY LEFTOVER FLAG
-- ------------------------------------------------------------
-- Currently a no-op (no row has the key), but makes the migration correct if
-- the function was ever run by hand against this database.

UPDATE projects
SET meta = meta - 'is_popular'
WHERE meta ? 'is_popular';


-- ------------------------------------------------------------
-- 3. UNRELATED, BUT WORTH KNOWING
-- ------------------------------------------------------------
-- All five projects currently have featured = true, so the "Featured" badge
-- renders on every card and distinguishes nothing. That is content, not code
-- - set featured = false on the ones that are not, or the badge carries no
-- information:
--
--   UPDATE projects SET featured = FALSE WHERE slug NOT IN ('...', '...');
