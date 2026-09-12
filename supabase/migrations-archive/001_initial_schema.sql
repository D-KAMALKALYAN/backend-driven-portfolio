-- ============================================================
-- FILE: supabase/migrations/001_initial_schema.sql
-- PROJECT: Backend-Driven Portfolio
-- AUTHOR: Kamal Kalyan
-- ============================================================
-- Run order is critical. Do NOT reorder sections.
-- Execute in: Supabase Dashboard → SQL Editor
-- !! Before running: replace 'your-admin@email.com'
--    in the is_admin() function (~line 230) with your actual
--    Supabase Auth user email.
-- ============================================================


-- ------------------------------------------------------------
-- 0. EXTENSIONS
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------

-- 1.1 profiles
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     TEXT NOT NULL,
  title         TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  location      TEXT,
  website_url   TEXT,
  github_url    TEXT,
  linkedin_url  TEXT,
  twitter_url   TEXT,
  resume_url    TEXT,
  meta          JSONB DEFAULT '{}'::JSONB,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_email ON profiles(email);


-- 1.2 projects
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  cover_image_url TEXT,
  demo_url        TEXT,
  repo_url        TEXT,
  case_study_url  TEXT,
  tech_stack      TEXT[] DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  status          TEXT DEFAULT 'published'
                  CHECK (status IN ('draft', 'published', 'archived')),
  featured        BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  view_count      INTEGER DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  meta            JSONB DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_slug     ON projects(slug);
CREATE INDEX idx_projects_status   ON projects(status);
CREATE INDEX idx_projects_featured ON projects(featured);
CREATE INDEX idx_projects_tags     ON projects USING GIN(tags);
CREATE INDEX idx_projects_stack    ON projects USING GIN(tech_stack);
CREATE INDEX idx_projects_views    ON projects(view_count DESC);


-- 1.3 project_sections
CREATE TABLE project_sections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN ('text', 'image', 'video', 'code', 'metrics', 'gallery', 'custom')),
  title       TEXT,
  content     JSONB NOT NULL DEFAULT '{}'::JSONB,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_sections_project_id ON project_sections(project_id);
CREATE INDEX idx_project_sections_type       ON project_sections(type);


-- 1.4 skills
CREATE TABLE skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL
              CHECK (category IN ('language', 'framework', 'tool', 'platform', 'soft', 'other')),
  proficiency INTEGER DEFAULT 80 CHECK (proficiency BETWEEN 0 AND 100),
  icon_url    TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  meta        JSONB DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_featured ON skills(is_featured);


-- 1.5 experience
CREATE TABLE experience (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company      TEXT NOT NULL,
  role         TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  type         TEXT DEFAULT 'full-time'
               CHECK (type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'volunteer')),
  start_date   DATE NOT NULL,
  end_date     DATE,
  is_current   BOOLEAN DEFAULT FALSE,
  tech_used    TEXT[] DEFAULT '{}',
  highlights   TEXT[] DEFAULT '{}',
  company_url  TEXT,
  company_logo TEXT,
  sort_order   INTEGER DEFAULT 0,
  meta         JSONB DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experience_is_current ON experience(is_current);
CREATE INDEX idx_experience_start_date ON experience(start_date DESC);


-- 1.6 achievements
CREATE TABLE achievements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  issuer         TEXT,
  type           TEXT DEFAULT 'certification'
                 CHECK (type IN ('certification', 'award', 'publication', 'speaking', 'open-source', 'other')),
  description    TEXT,
  date_earned    DATE,
  expiry_date    DATE,
  credential_url TEXT,
  image_url      TEXT,
  is_featured    BOOLEAN DEFAULT FALSE,
  sort_order     INTEGER DEFAULT 0,
  meta           JSONB DEFAULT '{}'::JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_achievements_type        ON achievements(type);
CREATE INDEX idx_achievements_is_featured ON achievements(is_featured);


-- 1.7 contact_messages
CREATE TABLE contact_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT,
  message     TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  status      TEXT DEFAULT 'unread'
              CHECK (status IN ('unread', 'read', 'replied', 'spam', 'archived')),
  replied_at  TIMESTAMPTZ,
  meta        JSONB DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_status     ON contact_messages(status);
CREATE INDEX idx_contact_messages_email      ON contact_messages(email);
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);


-- 1.8 analytics
CREATE TABLE analytics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event       TEXT NOT NULL,
  path        TEXT,
  referrer    TEXT,
  user_agent  TEXT,
  ip_address  TEXT,
  country     TEXT,
  session_id  TEXT,
  meta        JSONB DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_event      ON analytics(event);
CREATE INDEX idx_analytics_path       ON analytics(path);
CREATE INDEX idx_analytics_created_at ON analytics(created_at DESC);
CREATE INDEX idx_analytics_session    ON analytics(session_id);


-- 1.9 resume
CREATE TABLE resume (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version     TEXT NOT NULL UNIQUE,
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- 1.10 site_content
CREATE TABLE site_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT,
  value_json  JSONB,
  section     TEXT,
  type        TEXT DEFAULT 'text'
              CHECK (type IN ('text', 'markdown', 'html', 'json', 'url', 'boolean')),
  is_public   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_site_content_key     ON site_content(key);
CREATE INDEX idx_site_content_section ON site_content(section);


-- 1.11 activity_logs
CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor       TEXT NOT NULL DEFAULT 'system',
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   UUID,
  diff        JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_table_name ON activity_logs(table_name);
CREATE INDEX idx_activity_logs_record_id  ON activity_logs(record_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);


-- 1.12 feature_flags
CREATE TABLE feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  enabled     BOOLEAN DEFAULT FALSE,
  description TEXT,
  meta        JSONB DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2. FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------

-- 2.1 Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'projects', 'project_sections', 'skills',
    'experience', 'achievements', 'resume', 'site_content', 'feature_flags'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_update_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;


-- 2.2 Enforce single active resume
CREATE OR REPLACE FUNCTION enforce_single_active_resume()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE resume
    SET is_active = FALSE
    WHERE id <> NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_active_resume
BEFORE INSERT OR UPDATE ON resume
FOR EACH ROW EXECUTE FUNCTION enforce_single_active_resume();


-- 2.3 Auto-insert resume record on storage upload
-- NOTE: Replace the project ref URL with your actual Supabase project URL
CREATE OR REPLACE FUNCTION handle_resume_upload()
RETURNS TRIGGER AS $$
DECLARE
  public_url TEXT;
BEGIN
  IF NEW.bucket_id != 'resumes' THEN
    RETURN NEW;
  END IF;

  -- !! Replace with your actual project URL !!
  public_url := 'https://your-project-ref.supabase.co/storage/v1/object/public/resumes/' || NEW.name;

  UPDATE resume SET is_active = FALSE WHERE is_active = TRUE;

  INSERT INTO resume (version, file_url, file_name, is_active)
  VALUES (
    to_char(NOW(), 'YYYY-MM-DD-HH24MI'),
    public_url,
    NEW.name,
    TRUE
  )
  ON CONFLICT (version) DO UPDATE
    SET file_url   = EXCLUDED.file_url,
        file_name  = EXCLUDED.file_name,
        is_active  = TRUE,
        updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_resume_upload
AFTER INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION handle_resume_upload();


-- 2.4 Analytics → auto-increment project view_count
CREATE OR REPLACE FUNCTION handle_analytics_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event = 'project_view' AND NEW.meta->>'project_id' IS NOT NULL THEN
    UPDATE projects
    SET view_count = view_count + 1
    WHERE id = (NEW.meta->>'project_id')::UUID;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_handle_analytics
AFTER INSERT ON analytics
FOR EACH ROW EXECUTE FUNCTION handle_analytics_event();


-- 2.5 Contact form rate limiter (max 3 per email per 24h)
CREATE OR REPLACE FUNCTION check_contact_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM contact_messages
  WHERE email = NEW.email
    AND created_at > NOW() - INTERVAL '24 hours';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Max 3 messages per 24 hours.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_rate_limit
BEFORE INSERT ON contact_messages
FOR EACH ROW EXECUTE FUNCTION check_contact_rate_limit();


-- 2.6 Analytics abuse guard (max 100 events per session per hour)
CREATE OR REPLACE FUNCTION check_analytics_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_count
    FROM analytics
    WHERE session_id = NEW.session_id
      AND created_at > NOW() - INTERVAL '1 hour';

    IF recent_count >= 100 THEN
      RETURN NULL; -- silently drop
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_analytics_rate_limit
BEFORE INSERT ON analytics
FOR EACH ROW EXECUTE FUNCTION check_analytics_rate_limit();


-- 2.7 Popular badge refresh (called by Edge Function cron daily)
CREATE OR REPLACE FUNCTION refresh_popular_badges()
RETURNS VOID AS $$
BEGIN
  UPDATE projects SET meta = meta - 'is_popular';

  UPDATE projects
  SET meta = meta || '{"is_popular": true}'::JSONB
  WHERE id IN (
    SELECT id FROM projects
    WHERE status = 'published'
    ORDER BY view_count DESC
    LIMIT 3
  );
END;
$$ LANGUAGE plpgsql;


-- 2.8 Admin check helper
-- !! REPLACE 'your-admin@email.com' with your actual Supabase Auth email !!
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') = 'your-admin@email.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- 3. STORAGE BUCKETS
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'resumes',
    'resumes',
    TRUE,
    10485760,
    ARRAY['application/pdf']
  ),
  (
    'assets',
    'assets',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  )
ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience        ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume            ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags     ENABLE ROW LEVEL SECURITY;


-- 4.1 Public read policies

CREATE POLICY "Public can read active profile"
  ON profiles FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Public can read published projects"
  ON projects FOR SELECT
  USING (status = 'published');

CREATE POLICY "Public can read sections of published projects"
  ON project_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_sections.project_id
        AND p.status = 'published'
    )
  );

CREATE POLICY "Public can read skills"
  ON skills FOR SELECT USING (TRUE);

CREATE POLICY "Public can read experience"
  ON experience FOR SELECT USING (TRUE);

CREATE POLICY "Public can read achievements"
  ON achievements FOR SELECT USING (TRUE);

CREATE POLICY "Public can read active resume"
  ON resume FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Public can read site content"
  ON site_content FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "Public can read feature flags"
  ON feature_flags FOR SELECT USING (TRUE);


-- 4.2 Controlled public insert policies

CREATE POLICY "Anyone can submit contact message"
  ON contact_messages FOR INSERT
  WITH CHECK (
    length(name) > 0
    AND length(message) > 0
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

CREATE POLICY "Anyone can insert analytics"
  ON analytics FOR INSERT
  WITH CHECK (
    event IS NOT NULL
    AND length(event) < 100
  );


-- 4.3 Admin write policies

CREATE POLICY "Admin can manage profiles"
  ON profiles FOR ALL USING (is_admin());

CREATE POLICY "Admin can insert projects"
  ON projects FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin can update projects"
  ON projects FOR UPDATE USING (is_admin());

CREATE POLICY "Admin can delete projects"
  ON projects FOR DELETE USING (is_admin());

CREATE POLICY "Admin can manage project sections"
  ON project_sections FOR ALL USING (is_admin());

CREATE POLICY "Admin can manage skills"
  ON skills FOR ALL USING (is_admin());

CREATE POLICY "Admin can manage experience"
  ON experience FOR ALL USING (is_admin());

CREATE POLICY "Admin can manage achievements"
  ON achievements FOR ALL USING (is_admin());

CREATE POLICY "Admin can manage contact messages"
  ON contact_messages FOR ALL USING (is_admin());

CREATE POLICY "Admin can manage resume"
  ON resume FOR ALL USING (is_admin());

CREATE POLICY "Admin can manage site content"
  ON site_content FOR ALL USING (is_admin());

CREATE POLICY "Admin can read activity logs"
  ON activity_logs FOR SELECT USING (is_admin());

CREATE POLICY "Admin can manage feature flags"
  ON feature_flags FOR ALL USING (is_admin());


-- 4.4 Storage RLS policies

CREATE POLICY "Public can view assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assets');

CREATE POLICY "Public can view resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

CREATE POLICY "Admin can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'assets' AND is_admin());

CREATE POLICY "Admin can delete assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'assets' AND is_admin());

CREATE POLICY "Admin can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND is_admin());

CREATE POLICY "Admin can delete resumes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resumes' AND is_admin());


-- ------------------------------------------------------------
-- 5. REALTIME
-- ------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE contact_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE analytics;


-- ------------------------------------------------------------
-- 6. SEED DATA
-- ------------------------------------------------------------

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('show_blog',           FALSE, 'Toggle blog section visibility'),
  ('enable_hire_me_btn',  TRUE,  'Show hire me CTA button'),
  ('show_analytics_dash', FALSE, 'Internal: show analytics in admin'),
  ('maintenance_mode',    FALSE, 'Put site in maintenance mode')
ON CONFLICT (key) DO NOTHING;

INSERT INTO site_content (key, value, section, type) VALUES
  ('hero.headline',    'Hi, I''m Kamal.',                    'hero',  'text'),
  ('hero.subheadline', 'Backend-focused engineer.',           'hero',  'text'),
  ('hero.cta_label',   'View My Work',                       'hero',  'text'),
  ('about.paragraph',  'Replace this with your about text.', 'about', 'markdown'),
  ('footer.copyright', '© 2025 Kamal Kalyan',               'footer','text'),
  ('seo.title',        'Kamal Kalyan — Portfolio',           'seo',   'text'),
  ('seo.description',  'Backend engineer. System thinker.',  'seo',   'text')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- END OF MIGRATION
-- Two things to do before running:
-- 1. Replace 'your-admin@email.com' in is_admin() (~line 230)
-- 2. Replace 'your-project-ref' in handle_resume_upload() (~line 180)
-- ============================================================