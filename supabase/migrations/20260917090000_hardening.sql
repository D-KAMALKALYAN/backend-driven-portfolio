-- ============================================================
-- hardening
--
-- The last database-layer items on the roadmap, checked against production
-- before writing (ADR-042):
--
-- 0.9  The resumes bucket could be LISTED by anyone. The policy is named
--      "Admin can read resumes" but is `FOR SELECT TO PUBLIC USING
--      (bucket_id = 'resumes')` - the name lied, and the audit item was
--      marked done on the strength of the name. Verified live: the anon key
--      listed five objects, four of them superseded resumes. Dropping the
--      policy denies listing. Downloads are unaffected: the bucket is
--      public, and /storage/v1/object/public/... does not consult RLS.
--
-- 2.9  Soft delete in RLS was already true for projects, skills and
--      experience, and project_sections inherits it through an EXISTS. The
--      one gap: project_storytelling was `USING (true)`, so the case study
--      of a draft or deleted project was readable by id. Now inherits.
--
-- 2.10 The singleton profile index already exists (one_profile_row). The
--      remaining invariant: two sections of one project cannot share a
--      sort_order - two blocks with equal order render in whatever order
--      Postgres returns them. No duplicates in production; the index adds
--      the guarantee.
--
-- SAFE TO RE-RUN.
-- ============================================================


-- ------------------------------------------------------------
-- 0.9 Deny LIST on the resumes bucket
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can read resumes" ON storage.objects;
-- No replacement SELECT policy for anon: listing was the only thing it
-- granted. Uploads stay behind is_admin() (i.e. the dashboard or the
-- service role), as before.


-- ------------------------------------------------------------
-- 2.9 Storytelling inherits the project's visibility
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Public read storytelling" ON public.project_storytelling;
DROP POLICY IF EXISTS "Public can read storytelling of published projects" ON public.project_storytelling;
CREATE POLICY "Public can read storytelling of published projects" ON public.project_storytelling
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_storytelling.project_id
      AND p.status = 'published'
      AND p.is_deleted = FALSE
  ));


-- ------------------------------------------------------------
-- 2.10 Section ordering is unique per project
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS project_sections_project_sort_key
  ON public.project_sections (project_id, sort_order);


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
-- From outside, with the anon key:
--   POST /storage/v1/object/list/resumes   -> []        (was 5 objects)
--   GET  /storage/v1/object/public/resumes/<active file>  -> 200 (unchanged)
-- Locally, as anon:
--   soft-delete a project -> its storytelling rows disappear
--   INSERT a second project_sections row with an existing sort_order -> 23505
