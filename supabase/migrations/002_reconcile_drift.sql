-- ============================================================
-- 002_reconcile_drift.sql
-- Brings the repo's schema definition in line with production and
-- fixes defects found in the 2026-08-30 audit.
--
-- SAFE TO RE-RUN: every statement is idempotent.
--
-- NOTE: 001_initial_schema.sql does NOT describe production. Objects
-- below (external_profiles, project_storytelling, analytics_daily_visits,
-- get_analytics_summary, is_deleted columns) exist in the live database
-- but appear in no migration. This file records them so the repo can
-- rebuild the database. The durable fix is `supabase db pull` to generate
-- a real baseline - see developer-notes/discussions/003-schema-drift.md.
-- ============================================================


-- ------------------------------------------------------------
-- 1. FIX SHIPPED PLACEHOLDERS FROM 001
-- ------------------------------------------------------------
-- 001 shipped is_admin() comparing against 'your-admin@email.com'. Applied
-- verbatim to a fresh project, EVERY admin policy evaluates false.
-- Drive it from a setting instead of a literal so it is environment-safe.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(auth.jwt() ->> 'email', '')
         = COALESCE(current_setting('app.admin_email', TRUE), '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Set once per project (persists across connections):
--   ALTER DATABASE postgres SET app.admin_email = 'you@example.com';


-- ------------------------------------------------------------
-- 2. RESUME: store the object path, not a hand-built URL
-- ------------------------------------------------------------
-- handle_resume_upload() built file_url by string concatenation, so a
-- filename containing a space produced a URL that does not resolve.
-- Verified: the stored URL fails; the percent-encoded form returns 200.
-- Store the object name and let the Storage SDK encode it at read time.

ALTER TABLE resume ADD COLUMN IF NOT EXISTS storage_path TEXT;

UPDATE resume
SET storage_path = COALESCE(
      storage_path,
      file_name,
      regexp_replace(file_url, '^.*/resumes/', '')
    )
WHERE storage_path IS NULL;

-- "At most one active resume" as a declarative invariant. The existing
-- trigger silently rewrote OTHER rows to make room, with no audit record.
-- A partial unique index fails loudly instead of mutating at a distance.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_resume
  ON resume (is_active) WHERE is_active;

-- Retire the trigger the index replaces. Leaving both in place would keep
-- the silent-mutation behaviour the index exists to remove: activating one
-- resume would still quietly deactivate another with no record of it.
-- With the index alone, a second activation fails loudly (23505) and the
-- caller must deactivate the current one explicitly.
DROP TRIGGER IF EXISTS trg_single_active_resume ON resume;
DROP FUNCTION IF EXISTS enforce_single_active_resume();

-- Rebuild the upload trigger: record the object name, and do NOT
-- auto-publish. Uploading a draft should not change what visitors see.
CREATE OR REPLACE FUNCTION handle_resume_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bucket_id IS DISTINCT FROM 'resumes' THEN
    RETURN NEW;
  END IF;

  INSERT INTO resume (version, file_url, file_name, storage_path, is_active)
  VALUES (
    to_char(NOW(), 'YYYY-MM-DD-HH24MISS'),  -- seconds: minute precision collided
    NULL,                                    -- resolved at read time
    NEW.name,
    NEW.name,
    FALSE                                    -- publish is an explicit action
  )
  ON CONFLICT (version) DO UPDATE
    SET file_name    = EXCLUDED.file_name,
        storage_path = EXCLUDED.storage_path,
        updated_at   = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- 3. SOFT DELETE: enforce it, or it is not a delete
-- ------------------------------------------------------------
-- is_deleted exists on projects/skills/experience but only ONE query
-- filtered it. Enforcing in RLS makes the guarantee hold for every
-- client, including direct API calls - not just for callers who remember.

ALTER TABLE projects   ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE skills     ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE experience ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

DROP POLICY IF EXISTS "Public can read published projects" ON projects;
CREATE POLICY "Public can read published projects"
  ON projects FOR SELECT
  USING (status = 'published' AND is_deleted = FALSE);

DROP POLICY IF EXISTS "Public can read skills" ON skills;
CREATE POLICY "Public can read skills"
  ON skills FOR SELECT USING (is_deleted = FALSE);

DROP POLICY IF EXISTS "Public can read experience" ON experience;
CREATE POLICY "Public can read experience"
  ON experience FOR SELECT USING (is_deleted = FALSE);

DROP POLICY IF EXISTS "Public can read sections of published projects" ON project_sections;
CREATE POLICY "Public can read sections of published projects"
  ON project_sections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_sections.project_id
      AND p.status = 'published'
      AND p.is_deleted = FALSE
  ));


-- ------------------------------------------------------------
-- 4. MISSING INTEGRITY CONSTRAINTS
-- ------------------------------------------------------------

-- Nothing prevented an inverted date range.
ALTER TABLE experience DROP CONSTRAINT IF EXISTS valid_date_range;
ALTER TABLE experience ADD  CONSTRAINT valid_date_range
  CHECK (end_date IS NULL OR end_date >= start_date);

-- is_current duplicated (end_date IS NULL) with nothing keeping them
-- consistent: a row could be is_current with an end_date in the past.
ALTER TABLE experience DROP CONSTRAINT IF EXISTS current_implies_no_end;
ALTER TABLE experience ADD  CONSTRAINT current_implies_no_end
  CHECK (is_current = (end_date IS NULL));

-- type='json' with a NULL value_json was legal and rendered nothing.
ALTER TABLE site_content DROP CONSTRAINT IF EXISTS json_type_has_json;
ALTER TABLE site_content ADD  CONSTRAINT json_type_has_json
  CHECK (type <> 'json' OR value_json IS NOT NULL);

-- profiles is effectively a singleton but nothing enforced it; fetchProfile()
-- uses .single(), which throws on 0 or 2 rows.
--
-- Indexing a bare constant expression is not reliably portable, so this
-- guards the property that actually matters and mirrors the resume pattern:
-- at most one ACTIVE profile. The public read policy already filters on
-- is_active, so this is what .single() actually depends on.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_profile
  ON profiles (is_active) WHERE is_active;

-- project_sections.sort_order existed but ordering was non-deterministic.
CREATE INDEX IF NOT EXISTS idx_project_sections_order
  ON project_sections (project_id, sort_order);


-- ------------------------------------------------------------
-- 5. DROP REDUNDANT INDEXES
-- ------------------------------------------------------------
-- A UNIQUE constraint already creates an index. These duplicate it and
-- only add write cost.
DROP INDEX IF EXISTS idx_projects_slug;
DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_site_content_key;


-- ------------------------------------------------------------
-- 6. ANALYTICS: index supporting the rate-limit trigger
-- ------------------------------------------------------------
-- check_analytics_rate_limit() runs COUNT(*) filtered by session_id AND
-- created_at on every insert. Only session_id was indexed.
CREATE INDEX IF NOT EXISTS idx_analytics_session_time
  ON analytics (session_id, created_at DESC);


-- ------------------------------------------------------------
-- 7. ZERO-FILL THE DAILY VISITS VIEW
-- ------------------------------------------------------------
-- The view returned only days WITH traffic (18 rows across a 30-day span),
-- and the chart plots points at even x-intervals - so a 7-day gap looked
-- identical to a 1-day gap. Generate the full series so the axis is honest.

CREATE OR REPLACE VIEW analytics_daily_visits AS
SELECT
  d.date::DATE                                            AS date,
  COALESCE(COUNT(a.id)               FILTER (WHERE a.id IS NOT NULL), 0)::BIGINT AS visits,
  COALESCE(COUNT(DISTINCT a.session_id), 0)::BIGINT                              AS unique_visitors
FROM generate_series(
       (CURRENT_DATE - INTERVAL '29 days')::DATE,
       CURRENT_DATE,
       INTERVAL '1 day'
     ) AS d(date)
LEFT JOIN analytics a
  ON a.created_at::DATE = d.date::DATE
 AND a.event = 'page_view'
GROUP BY d.date
ORDER BY d.date ASC;


-- ------------------------------------------------------------
-- 8. RECOMPUTE PROJECT VIEW COUNTS
-- ------------------------------------------------------------
-- view_count is a denormalized counter that only ever increments, so it
-- inherited every duplicate analytics write and drift was permanent and
-- undetectable. This makes it recoverable from source.

CREATE OR REPLACE FUNCTION refresh_project_view_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE projects p
  SET view_count = COALESCE(c.n, 0)
  FROM (
    SELECT (meta ->> 'project_id')::UUID AS pid, COUNT(*) AS n
    FROM analytics
    WHERE event = 'project_view'
      AND meta ->> 'project_id' IS NOT NULL
      AND meta ->> 'project_id' ~ '^[0-9a-fA-F-]{36}$'
    GROUP BY 1
  ) c
  WHERE p.id = c.pid;
END;
$$ LANGUAGE plpgsql;
