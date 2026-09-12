SET local check_function_bodies = off;

CREATE EXTENSION "pg_trgm" SCHEMA "public";

CREATE TABLE "public"."achievements" (
  "id"             uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "title"          text                     NOT NULL,
  "issuer"         text,
  "type"           text                     DEFAULT 'certification'::text,
  "description"    text,
  "date_earned"    date,
  "expiry_date"    date,
  "credential_url" text,
  "image_url"      text,
  "is_featured"    boolean                  DEFAULT false,
  "sort_order"     integer                  DEFAULT 0,
  "meta"           jsonb                    DEFAULT '{}'::jsonb,
  "created_at"     timestamp with time zone DEFAULT now(),
  "updated_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "achievements_pkey" PRIMARY KEY (id),
  CONSTRAINT "achievements_type_check" CHECK ((type = ANY (ARRAY['certification'::text, 'award'::text, 'publication'::text, 'speaking'::text, 'open-source'::text, 'other'::text])))
);

ALTER TABLE "public"."achievements"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."activity_logs" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "actor"      text                     NOT NULL DEFAULT 'system'::text,
  "action"     text                     NOT NULL,
  "table_name" text                     NOT NULL,
  "record_id"  uuid,
  "diff"       jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."activity_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."analytics" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "event"       text                     NOT NULL,
  "path"        text,
  "referrer"    text,
  "user_agent"  text,
  "ip_address"  text,
  "country"     text,
  "session_id"  text,
  "meta"        jsonb                    DEFAULT '{}'::jsonb,
  "created_at"  timestamp with time zone DEFAULT now(),
  "device_type" text,
  CONSTRAINT "analytics_event_known"
    CHECK
    ((event = ANY (ARRAY['page_view'::text, 'project_view'::text, 'resume_download'::text, 'contact_open'::text, 'profile_click'::text, 'github_click'::text, 'demo_click'::text,
    'venture_click'::text]))),
  CONSTRAINT "analytics_field_sizes"
    CHECK
    ((((path IS NULL) OR (char_length(path) <= 512)) AND ((referrer IS NULL) OR (char_length(referrer) <= 1024)) AND ((user_agent IS NULL) OR (char_length(user_agent) <= 512)) AND
    ((session_id IS NULL) OR (char_length(session_id) <= 64)) AND ((meta IS NULL) OR (char_length((meta)::text) <= 4096)))),
  CONSTRAINT "analytics_meta_is_object" CHECK (((meta IS NULL) OR (jsonb_typeof(meta) = 'object'::text))),
  CONSTRAINT "analytics_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."analytics"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."contact_messages" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"       text                     NOT NULL,
  "email"      text                     NOT NULL,
  "subject"    text,
  "message"    text                     NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "status"     text                     DEFAULT 'unread'::text,
  "replied_at" timestamp with time zone,
  "meta"       jsonb                    DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "contact_messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "contact_messages_status_check" CHECK ((status = ANY (ARRAY['unread'::text, 'read'::text, 'replied'::text, 'spam'::text, 'archived'::text])))
);

ALTER TABLE "public"."contact_messages"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."experience" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "company"      text                     NOT NULL,
  "role"         text                     NOT NULL,
  "description"  text,
  "location"     text,
  "type"         text                     DEFAULT 'full-time'::text,
  "start_date"   date                     NOT NULL,
  "end_date"     date,
  "is_current"   boolean                  DEFAULT false,
  "tech_used"    text[]                   DEFAULT '{}'::text[],
  "highlights"   text[]                   DEFAULT '{}'::text[],
  "company_url"  text,
  "company_logo" text,
  "sort_order"   integer                  DEFAULT 0,
  "meta"         jsonb                    DEFAULT '{}'::jsonb,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  "is_deleted"   boolean                  DEFAULT false,
  CONSTRAINT "current_implies_no_end" CHECK ((is_current = (end_date IS NULL))),
  CONSTRAINT "experience_pkey" PRIMARY KEY (id),
  CONSTRAINT "experience_type_check" CHECK ((type = ANY (ARRAY['full-time'::text, 'part-time'::text, 'contract'::text, 'freelance'::text, 'internship'::text, 'volunteer'::text]))),
  CONSTRAINT "valid_date_range" CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);

ALTER TABLE "public"."experience"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."external_profiles" (
  "id"            uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "platform"      text                     NOT NULL,
  "username"      text,
  "profile_url"   text                     NOT NULL,
  "icon_url"      text,
  "display_order" integer                  DEFAULT 0,
  "is_active"     boolean                  DEFAULT true,
  "meta"          jsonb                    DEFAULT '{}'::jsonb,
  "created_at"    timestamp with time zone DEFAULT now(),
  "updated_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "external_profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."external_profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."feature_flags" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "key"         text                     NOT NULL,
  "enabled"     boolean                  DEFAULT false,
  "description" text,
  "meta"        jsonb                    DEFAULT '{}'::jsonb,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "feature_flags_key_key" UNIQUE (key),
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."feature_flags"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "full_name"    text                     NOT NULL,
  "title"        text,
  "bio"          text,
  "avatar_url"   text,
  "email"        text                     NOT NULL,
  "phone"        text,
  "location"     text,
  "website_url"  text,
  "github_url"   text,
  "linkedin_url" text,
  "twitter_url"  text,
  "resume_url"   text,
  "meta"         jsonb                    DEFAULT '{}'::jsonb,
  "is_active"    boolean                  DEFAULT true,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "profiles_email_key" UNIQUE (email),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."project_sections" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "project_id" uuid                     NOT NULL,
  "type"       text                     NOT NULL,
  "title"      text,
  "content"    jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "sort_order" integer                  DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "project_sections_pkey" PRIMARY KEY (id),
  CONSTRAINT "project_sections_type_check" CHECK ((type = ANY (ARRAY['text'::text, 'image'::text, 'video'::text, 'code'::text, 'metrics'::text, 'gallery'::text, 'custom'::text])))
);

ALTER TABLE "public"."project_sections"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."project_storytelling" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "project_id"   uuid                     NOT NULL,
  "section_type" text                     NOT NULL,
  "title"        text,
  "body"         text                     NOT NULL,
  "sort_order"   integer                  DEFAULT 0,
  "created_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "project_storytelling_pkey" PRIMARY KEY (id),
  CONSTRAINT "project_storytelling_project_id_section_type_key" UNIQUE (project_id, section_type),
  CONSTRAINT "project_storytelling_section_type_check"
    CHECK ((section_type = ANY (ARRAY['why_this_project'::text, 'problem_statement'::text, 'solution_approach'::text, 'tradeoffs'::text, 'impact'::text])))
);

ALTER TABLE "public"."project_storytelling"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."projects" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "slug"            text                     NOT NULL,
  "title"           text                     NOT NULL,
  "tagline"         text,
  "description"     text,
  "cover_image_url" text,
  "demo_url"        text,
  "repo_url"        text,
  "case_study_url"  text,
  "tech_stack"      text[]                   DEFAULT '{}'::text[],
  "tags"            text[]                   DEFAULT '{}'::text[],
  "status"          text                     DEFAULT 'published'::text,
  "featured"        boolean                  DEFAULT false,
  "sort_order"      integer                  DEFAULT 0,
  "start_date"      date,
  "end_date"        date,
  "meta"            jsonb                    DEFAULT '{}'::jsonb,
  "created_at"      timestamp with time zone DEFAULT now(),
  "updated_at"      timestamp with time zone DEFAULT now(),
  "is_deleted"      boolean                  DEFAULT false,
  "view_count"      integer                  DEFAULT 0,
  CONSTRAINT "projects_pkey" PRIMARY KEY (id),
  CONSTRAINT "projects_slug_key" UNIQUE (slug),
  CONSTRAINT "projects_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);

ALTER TABLE "public"."projects"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."resume" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "version"      text                     NOT NULL,
  "file_url"     text                     NOT NULL,
  "file_name"    text                     NOT NULL,
  "is_active"    boolean                  DEFAULT false,
  "notes"        text,
  "created_at"   timestamp with time zone DEFAULT now(),
  "updated_at"   timestamp with time zone DEFAULT now(),
  "storage_path" text,
  CONSTRAINT "resume_pkey" PRIMARY KEY (id),
  CONSTRAINT "resume_version_key" UNIQUE (VERSION)
);

ALTER TABLE "public"."resume"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."site_content" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "key"        text                     NOT NULL,
  "value"      text,
  "value_json" jsonb,
  "section"    text,
  "type"       text                     DEFAULT 'text'::text,
  "is_public"  boolean                  DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "json_type_has_json" CHECK (((type <> 'json'::text) OR (value_json IS NOT NULL))),
  CONSTRAINT "site_content_key_key" UNIQUE (key),
  CONSTRAINT "site_content_pkey" PRIMARY KEY (id),
  CONSTRAINT "site_content_type_check" CHECK ((type = ANY (ARRAY['text'::text, 'markdown'::text, 'html'::text, 'json'::text, 'url'::text, 'boolean'::text])))
);

ALTER TABLE "public"."site_content"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."skills" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"        text                     NOT NULL,
  "category"    text                     NOT NULL,
  "proficiency" integer                  DEFAULT 80,
  "icon_url"    text,
  "is_featured" boolean                  DEFAULT false,
  "sort_order"  integer                  DEFAULT 0,
  "meta"        jsonb                    DEFAULT '{}'::jsonb,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  "is_deleted"  boolean                  DEFAULT false,
  CONSTRAINT "skills_category_check" CHECK ((category = ANY (ARRAY['language'::text, 'framework'::text, 'tool'::text, 'platform'::text, 'soft'::text, 'other'::text]))),
  CONSTRAINT "skills_name_key" UNIQUE (name),
  CONSTRAINT "skills_pkey" PRIMARY KEY (id),
  CONSTRAINT "skills_proficiency_check" CHECK (((proficiency >= 0) AND (proficiency <= 100)))
);

ALTER TABLE "public"."skills"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_single_active_resume()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE resume SET is_active = FALSE
    WHERE id <> NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_analytics_summary()
  RETURNS json
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  SELECT json_build_object(
    'total_visits',        (SELECT COUNT(*)                   FROM analytics WHERE event = 'page_view'),
    'unique_visitors',     (SELECT COUNT(DISTINCT session_id) FROM analytics WHERE event = 'page_view'),
    'total_project_views', (SELECT COUNT(*)                   FROM analytics WHERE event = 'project_view'),
    'visits_today',        (SELECT COUNT(*) FROM analytics
                             WHERE event = 'page_view'
                               AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE),
    'visits_this_week',    (SELECT COUNT(*) FROM analytics
                             WHERE event = 'page_view'
                               AND created_at >= DATE_TRUNC('week', NOW()))
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_analytics_event()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  pid UUID;
BEGIN
  IF NEW.event <> 'project_view' THEN
    RETURN NEW;
  END IF;

  IF NEW.meta ->> 'project_id' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN NEW;
  END IF;

  BEGIN
    pid := (NEW.meta ->> 'project_id')::UUID;
    UPDATE projects
    SET view_count = view_count + 1
    WHERE id = pid AND status = 'published' AND is_deleted = FALSE;
  EXCEPTION WHEN OTHERS THEN
    -- A counter update must never fail the event write.
    NULL;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_resume_upload()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.refresh_project_view_counts()
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE "public"."contact_messages"
  ADD CONSTRAINT "contact_message_len" CHECK (((char_length(message) >= 10) AND (char_length(message) <= 5000))) NOT VALID;

ALTER TABLE "public"."contact_messages"
  ADD CONSTRAINT "contact_name_len" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 100))) NOT VALID;

ALTER TABLE "public"."contact_messages"
  ADD CONSTRAINT "contact_no_markup" CHECK (((message !~ '<\s*/?\s*[a-zA-Z]'::text) AND (name !~ '<\s*/?\s*[a-zA-Z]'::text))) NOT VALID;

ALTER TABLE "public"."contact_messages"
  ADD CONSTRAINT "contact_subject_len" CHECK (((subject IS NULL) OR (char_length(subject) <= 200))) NOT VALID;

ALTER TABLE "public"."project_sections"
  ADD CONSTRAINT "project_sections_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE "public"."project_storytelling"
  ADD CONSTRAINT "project_storytelling_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE VIEW "public"."analytics_daily_visits" AS  SELECT (d.date)::date AS date,
    COALESCE(count(a.id) FILTER (WHERE (a.id IS NOT NULL)), (0)::bigint) AS visits,
    COALESCE(count(DISTINCT a.session_id), (0)::bigint) AS unique_visitors
   FROM (generate_series((((CURRENT_DATE - '29 days'::interval))::date)::timestamp with time zone, (CURRENT_DATE)::timestamp with time zone, '1 day'::interval) d(date)
     LEFT JOIN public.analytics a ON ((((a.created_at)::date = (d.date)::date) AND (a.event = 'page_view'::text))))
  GROUP BY d.date
  ORDER BY d.date;

CREATE UNIQUE INDEX analytics_event_key_idempotency ON public.analytics USING btree (((meta ->> 'event_key'::text)))
  WHERE ((meta ->> 'event_key'::text) IS NOT NULL);

CREATE INDEX idx_achievements_is_featured ON public.achievements USING btree (is_featured);

CREATE INDEX idx_achievements_type ON public.achievements USING btree (TYPE);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);

CREATE INDEX idx_activity_logs_record_id ON public.activity_logs USING btree (record_id);

CREATE INDEX idx_activity_logs_table_name ON public.activity_logs USING btree (table_name);

CREATE INDEX idx_analytics_created_at ON public.analytics USING btree (created_at DESC);

CREATE INDEX idx_analytics_event_created ON public.analytics USING btree (EVENT, created_at DESC);

CREATE INDEX idx_analytics_event ON public.analytics USING btree (EVENT);

CREATE INDEX idx_analytics_path ON public.analytics USING btree (path);

CREATE INDEX idx_analytics_session_time ON public.analytics USING btree (session_id, created_at DESC);

CREATE INDEX idx_analytics_session ON public.analytics USING btree (session_id);

CREATE INDEX idx_contact_messages_created_at ON public.contact_messages USING btree (created_at DESC);

CREATE INDEX idx_contact_messages_email ON public.contact_messages USING btree (email);

CREATE INDEX idx_contact_messages_status ON public.contact_messages USING btree (status);

CREATE INDEX idx_external_profiles_platform ON public.external_profiles USING btree (platform);

CREATE INDEX idx_project_sections_order ON public.project_sections USING btree (project_id, sort_order);

CREATE INDEX idx_project_sections_project_id ON public.project_sections USING btree (project_id);

CREATE INDEX idx_project_sections_type ON public.project_sections USING btree (TYPE);

CREATE INDEX idx_projects_featured ON public.projects USING btree (featured);

CREATE INDEX idx_projects_stack ON public.projects USING gin (tech_stack);

CREATE INDEX idx_projects_status ON public.projects USING btree (status);

CREATE INDEX idx_projects_tags ON public.projects USING gin (tags);

CREATE INDEX idx_site_content_section ON public.site_content USING btree (section);

CREATE INDEX idx_skills_category ON public.skills USING btree (category);

CREATE INDEX idx_skills_featured ON public.skills USING btree (is_featured);

CREATE INDEX idx_storytelling_project ON public.project_storytelling USING btree (project_id);

CREATE UNIQUE INDEX one_active_resume ON public.resume USING btree (is_active)
  WHERE is_active;

CREATE UNIQUE INDEX one_profile_row ON public.profiles USING btree ((true));

CREATE TRIGGER trg_handle_analytics
  AFTER INSERT ON public.analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_analytics_event();

CREATE TRIGGER trg_single_active_resume
  BEFORE INSERT OR UPDATE ON public.resume
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_active_resume();

CREATE TRIGGER trg_on_resume_upload
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_resume_upload();

CREATE POLICY "Admin can manage achievements" ON "public"."achievements"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read achievements" ON "public"."achievements"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Admin can read activity logs" ON "public"."activity_logs"
  FOR SELECT
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Allow public insert activity logs" ON "public"."activity_logs"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Public can insert analytics" ON "public"."analytics"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (((event IS NOT NULL) AND ((meta IS NULL) OR (jsonb_typeof(meta) = 'object'::text))));

CREATE POLICY "Public can read analytics" ON "public"."analytics"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "Admin can manage contact messages" ON "public"."contact_messages"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Public can submit contact message" ON "public"."contact_messages"
  FOR INSERT
  TO "anon", "authenticated"
  WITH
    CHECK
    ((((char_length(name) >= 2) AND (char_length(name) <= 100)) AND ((char_length(message) >= 10) AND (char_length(message) <= 5000)) AND (email ~*
    '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text) AND (status = 'unread'::text)));

CREATE POLICY "Admin can manage experience" ON "public"."experience"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read experience" ON "public"."experience"
  FOR SELECT
  TO PUBLIC
  USING ((is_deleted = false));

CREATE POLICY "Public can read profiles" ON "public"."external_profiles"
  FOR SELECT
  TO PUBLIC
  USING ((is_active = true));

CREATE POLICY "Admin can manage feature flags" ON "public"."feature_flags"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read feature flags" ON "public"."feature_flags"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Admin can update profile" ON "public"."profiles"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read profiles" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((is_active = true));

CREATE POLICY "Admin can manage project sections" ON "public"."project_sections"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read sections of published projects" ON "public"."project_sections"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_sections.project_id) AND (p.status = 'published'::text) AND (p.is_deleted = false)))));

CREATE POLICY "Public read storytelling" ON "public"."project_storytelling"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Admin can delete projects" ON "public"."projects"
  FOR DELETE
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Admin can insert projects" ON "public"."projects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update projects" ON "public"."projects"
  FOR UPDATE
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read published projects" ON "public"."projects"
  FOR SELECT
  TO PUBLIC
  USING (((status = 'published'::text) AND (is_deleted = false)));

CREATE POLICY "Admin can manage resume" ON "public"."resume"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Public can read active resume" ON "public"."resume"
  FOR SELECT
  TO "anon", "authenticated"
  USING ((is_active = true));

CREATE POLICY "Admin can manage site content" ON "public"."site_content"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read site content" ON "public"."site_content"
  FOR SELECT
  TO PUBLIC
  USING ((is_public = true));

CREATE POLICY "Admin can manage skills" ON "public"."skills"
  FOR ALL
  TO PUBLIC
  USING (public.is_admin());

CREATE POLICY "Public can read skills" ON "public"."skills"
  FOR SELECT
  TO PUBLIC
  USING ((is_deleted = false));

CREATE POLICY "Admin can delete assets" ON "storage"."objects"
  FOR DELETE
  TO PUBLIC
  USING (((bucket_id = 'assets'::text) AND public.is_admin()));

CREATE POLICY "Admin can read resumes" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'resumes'::text));

CREATE POLICY "Admin can upload assets" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((bucket_id = 'assets'::text) AND public.is_admin()));

CREATE POLICY "Admin can upload resumes" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((bucket_id = 'resumes'::text) AND public.is_admin()));

CREATE POLICY "Public can view assets" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'assets'::text));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."analytics";

COMMENT ON EXTENSION "pg_trgm" IS 'text similarity measurement and index searching based on trigrams';

GRANT EXECUTE ON FUNCTION "public"."enforce_single_active_resume"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_analytics_summary"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_analytics_event"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_resume_upload"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."refresh_project_view_counts"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."achievements" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."activity_logs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analytics" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."contact_messages" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."experience" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."external_profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."feature_flags" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."project_sections" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."project_storytelling" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."projects" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."resume" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."site_content" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."skills" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."analytics_daily_visits" TO "anon", "authenticated", "postgres", "service_role";

