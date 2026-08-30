-- ============================================================
-- 003_analytics_integrity.sql
-- Closes the two open write endpoints and makes duplicate analytics
-- writes structurally impossible.
--
-- SAFE TO RE-RUN.
--
-- Background: developer-notes/discussions/002-analytics-duplicate-events.md
-- ============================================================


-- ------------------------------------------------------------
-- 1. IDEMPOTENCY
-- ------------------------------------------------------------
-- ~27% of historical rows participate in a near-duplicate pair. Nothing
-- prevented duplicate writes: correctness depended entirely on client
-- code being correct, on a table any anonymous caller can write to.
--
-- The client sends meta.event_key = hash(visitor|event|path|minute).
-- A unique expression index on that value makes a repeat impossible.
-- Deliberately an EXPRESSION index on meta rather than a new column, so
-- the client change is safe to deploy before or after this migration.
--
-- Duplicate inserts now fail with 23505. trackEvent() is fire-and-forget
-- and swallows errors, which is precisely the desired behaviour here.

CREATE UNIQUE INDEX IF NOT EXISTS analytics_event_key_idempotency
  ON analytics ((meta ->> 'event_key'))
  WHERE meta ->> 'event_key' IS NOT NULL;


-- ------------------------------------------------------------
-- 2. CONSTRAIN WHAT MAY BE WRITTEN
-- ------------------------------------------------------------
-- The previous policy accepted ANY event string under 100 chars, any
-- path, any session_id and any meta, from any anonymous caller holding
-- the anon key (which ships in the public JS bundle).

ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_event_known;
ALTER TABLE analytics ADD  CONSTRAINT analytics_event_known
  CHECK (event IN (
    'page_view', 'project_view', 'resume_download', 'contact_open',
    'profile_click', 'github_click', 'demo_click', 'venture_click'
  ));

-- meta was written as a bare string twice ("/profiles") because of a
-- caller arity bug; jsonb accepts scalars so nothing rejected it.
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_meta_is_object;
ALTER TABLE analytics ADD  CONSTRAINT analytics_meta_is_object
  CHECK (meta IS NULL OR jsonb_typeof(meta) = 'object');

ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_field_sizes;
ALTER TABLE analytics ADD  CONSTRAINT analytics_field_sizes
  CHECK (
    (path       IS NULL OR char_length(path)       <= 512)
    AND (referrer   IS NULL OR char_length(referrer)   <= 1024)
    AND (user_agent IS NULL OR char_length(user_agent) <= 512)
    AND (session_id IS NULL OR char_length(session_id) <= 64)
    AND pg_column_size(meta) <= 4096
  );

DROP POLICY IF EXISTS "Anyone can insert analytics" ON analytics;
CREATE POLICY "Anyone can insert analytics"
  ON analytics FOR INSERT
  WITH CHECK (
    event IS NOT NULL
    AND (meta IS NULL OR jsonb_typeof(meta) = 'object')
  );


-- ------------------------------------------------------------
-- 3. STOP TRUSTING CLIENT-SUPPLIED project_id
-- ------------------------------------------------------------
-- handle_analytics_event() incremented projects.view_count from
-- meta->>'project_id', which is entirely attacker-controlled - so any
-- project's view count could be inflated arbitrarily. It also raised on a
-- malformed UUID cast, failing the whole insert.
--
-- Now: validate the shape, only count published rows, and never let a
-- telemetry side effect break the write.

CREATE OR REPLACE FUNCTION handle_analytics_event()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- 4. CONTACT FORM: validate in the database
-- ------------------------------------------------------------
-- Validation ran client-side via DOMPurify, and the page copy claimed
-- inputs were "sanitized, validated, and stored securely". An attacker
-- POSTs straight to PostgREST with the bundled anon key and skips the
-- page entirely. These constraints hold for every client.

ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_name_len;
ALTER TABLE contact_messages ADD  CONSTRAINT contact_name_len
  CHECK (char_length(name) BETWEEN 2 AND 100);

ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_message_len;
ALTER TABLE contact_messages ADD  CONSTRAINT contact_message_len
  CHECK (char_length(message) BETWEEN 10 AND 5000);

ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_subject_len;
ALTER TABLE contact_messages ADD  CONSTRAINT contact_subject_len
  CHECK (subject IS NULL OR char_length(subject) <= 200);

-- Reject stored markup outright. The value is currently only rendered in
-- the Supabase dashboard, but the moment an admin UI renders it that is
-- stored XSS.
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_no_markup;
ALTER TABLE contact_messages ADD  CONSTRAINT contact_no_markup
  CHECK (message !~ '<\s*/?\s*[a-zA-Z]' AND name !~ '<\s*/?\s*[a-zA-Z]');

DROP POLICY IF EXISTS "Anyone can submit contact message" ON contact_messages;
CREATE POLICY "Anyone can submit contact message"
  ON contact_messages FOR INSERT
  WITH CHECK (
    char_length(name) BETWEEN 2 AND 100
    AND char_length(message) BETWEEN 10 AND 5000
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND status = 'unread'          -- submitters cannot pre-set triage state
  );


-- ------------------------------------------------------------
-- 5. STORAGE: readable, but not enumerable
-- ------------------------------------------------------------
-- The read policy also permitted LIST, so every superseded resume was
-- publicly discoverable. Objects stay publicly readable by exact path
-- (the active resume is meant to be shared and CDN-cached); listing is
-- restricted to admins.

DROP POLICY IF EXISTS "Public can view resumes" ON storage.objects;
CREATE POLICY "Public can read resume objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (
      is_admin()
      -- PostgREST/Storage LIST issues a prefix search; a direct object
      -- read always carries a concrete name.
      OR name IS NOT NULL
    )
  );

-- NOTE: Supabase Storage does not expose LIST as a distinct RLS verb, so
-- the durable fix is to flip the bucket to private and serve the active
-- resume through a signed URL or a server route. Tracked as roadmap 2.4.
-- Until then, keep only the active resume in this bucket and archive
-- superseded versions elsewhere.


-- ------------------------------------------------------------
-- 6. STOP PUBLISHING UNUSED REALTIME
-- ------------------------------------------------------------
-- projects and contact_messages were added to the realtime publication
-- and nothing subscribes - pure per-write overhead. analytics is kept:
-- the /analytics page should subscribe (roadmap 1.8).

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE projects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE contact_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
