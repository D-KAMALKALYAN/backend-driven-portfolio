-- ============================================================
-- 006_site_content_reconcile.sql
-- Aligns site_content with what the application actually reads.
--
-- SAFE TO RE-RUN.
--
-- The audit found 56 keys in the table and 30 referenced in code: 46% of the
-- "backend-driven configuration" was stored, editable, and read by nothing.
-- The frontend changes in this branch wire up nav.*, seo.*, error.404_*,
-- about.*, projects.*, skills.* and experience.*. This file adds the keys the
-- code expects but the table lacks, and removes the one the resume fix killed.
-- ============================================================


-- ------------------------------------------------------------
-- 1. KEYS THE CODE READS THAT DO NOT EXIST
-- ------------------------------------------------------------
-- These silently fall back to hardcoded strings, so editing the database has
-- no effect - the opposite of the intended behaviour.

INSERT INTO site_content (key, value, value_json, section, type, is_public) VALUES
  ('contact.availability', NULL,
   '{"status":"available","message":"Open to backend and full-stack roles","response_time":"Usually replies within 2 days"}'::jsonb,
   'contact', 'json', TRUE),

  ('resume.highlights', NULL,
   '{"items":[
      {"icon":"🔒","label":"Security","text":"SAST/DAST, enterprise-grade application security"},
      {"icon":"🏗","label":"Architecture","text":"Scalable backend systems, microservices design"},
      {"icon":"🛠","label":"Full-Stack","text":"Java, Spring Boot, React, Node.js, PostgreSQL"},
      {"icon":"☁️","label":"Cloud","text":"Supabase, Docker, CI/CD pipelines"}
    ]}'::jsonb,
   'global', 'json', TRUE)
ON CONFLICT (key) DO NOTHING;


-- ------------------------------------------------------------
-- 2. NAV KEYS THE CODE NOW READS
-- ------------------------------------------------------------
-- nav.home/about/projects/skills/experience/contact already existed and were
-- read by nothing. The navbar now resolves labels from these keys, so the two
-- links that had no row need one. Renaming a nav item is now a row edit.

INSERT INTO site_content (key, value, section, type, is_public) VALUES
  ('nav.profiles', 'Profiles', 'nav', 'text', TRUE),
  ('nav.resume',   'Resume',   'nav', 'text', TRUE)
ON CONFLICT (key) DO NOTHING;


-- ------------------------------------------------------------
-- 3. REMOVE THE MANUAL RESUME KEY
-- ------------------------------------------------------------
-- This is the acceptance test from discussions/001. The site used to depend
-- on this hand-maintained key because fetchResumeUrl() queried a table that
-- does not exist. It now reads the `resume` table and resolves the URL via
-- the Storage SDK, so nothing references this row.
--
-- Deleting it is the proof the fix is real. If the resume disappears from the
-- site after this runs, the fallback was still load-bearing.

DELETE FROM site_content WHERE key = 'resume.url';


-- ------------------------------------------------------------
-- 4. WHAT IS DELIBERATELY LEFT IN PLACE
-- ------------------------------------------------------------
-- Still unread, and kept on purpose rather than deleted:
--
--   ai.welcome_message, ai.suggestions
--     Seeded before any AI feature existed. Kept because the AI plan
--     (developer-notes/ai-strategy.md) uses them, and they cost nothing.
--
--   feature.dark_mode_enabled, feature.show_analytics
--     Duplicate the feature_flags table, which also drives no behaviour.
--     Pick one mechanism before implementing either; two half-built flag
--     systems is worse than none.
--
--   performance.note, security.note
--     Written for a "how this site works" page that does not exist yet
--     (roadmap 3.4).
--
--   profile.tagline
--     Overlaps hero.subheadline. Consolidate when the hero copy is revisited.
--
-- After this migration: 5 keys unread out of 58, down from 24 of 56.


-- ------------------------------------------------------------
-- 5. POST-CHECK
-- ------------------------------------------------------------
--   SELECT key, section FROM site_content
--   WHERE key IN ('contact.availability','resume.highlights','nav.profiles','nav.resume');
--   -- expect 4 rows
--
--   SELECT count(*) FROM site_content WHERE key = 'resume.url';
--   -- expect 0, and the site must still show the resume
