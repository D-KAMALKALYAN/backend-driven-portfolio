-- ============================================================
-- experience: the two TCS roles, re-cut for the page that renders them
--
-- Both rows carried everything in one `description` paragraph and left
-- `highlights` and `tech_used` NULL. views/Experience.tsx reads those three
-- columns differently: the card and the drawer's "Overview" show only
-- description's first line, "Key Highlights" renders `highlights` (falling
-- back to splitting description on newlines, which a single paragraph never
-- triggers), and "Technologies" renders `tech_used`. So a one-paragraph row
-- renders as a clamped blurb with two empty sections underneath.
--
-- This puts an overview in `description` and the points in `highlights`,
-- where ask_corpus() also reads them (20260922160000: the experience body is
-- company + description + highlights), so /ask gains the detail too. The
-- backend role takes the current resume, which adds security remediation
-- across the five codebases, the metadata-driven configuration work, the
-- contract-first API documentation, and the prototyping. The security role
-- keeps exactly the facts it already had, moved out of the paragraph.
--
-- `role` is NOT touched: content_chunks' RLS policy matches a chunk to its
-- row by `e.role = content_chunks.title`, so renaming a role would orphan
-- every chunk indexed for it until the next re-index.
--
-- The UPDATE on public.experience fires notify_revalidate (20260918090000),
-- which purges `table:experience` and `content`. The embeddings index sees a
-- new content hash and re-embeds both documents on the cron's next run.
--
-- SAFE TO RE-RUN (sets the same values).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Backend Developer (current)
-- ------------------------------------------------------------
UPDATE public.experience
SET description = 'Backend services for five enterprise applications in the aerospace domain. The work is API design, business rules that live in data rather than in code, PostgreSQL performance, and the tests and security reviews a release has to pass. The largest of them is a Laboratory Information Management System, built as a modular monolith with explicit domain boundaries and standardized API contracts, so another laboratory module can be onboarded with minimal changes to what is already there.',
    highlights = ARRAY[
      '15+ REST APIs across five enterprise applications, built in Spring Boot with the same layering, documented contract-first in Swagger/OpenAPI and failing in one standard shape. Frontend and backend integrate against one set of rules rather than five.',
      'Business rules moved out of the code and into data: dynamic enums, database-backed lookup tables and configurable rule engines. Changing a rule no longer means editing hardcoded logic in several modules.',
      'PostgreSQL bottlenecks behind business-critical workflows, traced and removed: redundant queries, join strategy, and the access patterns underneath. Response times came down.',
      'Legacy components refactored towards modules that know less about each other, with the same patterns carried into code review. New features in the parts that were done take less time to build.',
      'Security findings owned end to end across all five codebases: injection flaws, insecure API configuration, access-control gaps. Releases went to production with none of them open, in step with the security review cycles.',
      'Unit and integration tests in JUnit 5 and Mockito alongside every new API, covering the contract and the business logic across service boundaries.',
      '3+ upcoming features prototyped before the sprint committed to them, while backing out was still cheap.'
    ],
    tech_used  = ARRAY['Java', 'Spring Boot', 'PostgreSQL', 'REST', 'Swagger/OpenAPI', 'JUnit 5', 'Mockito'],
    updated_at = NOW()
WHERE company = 'Tata Consultancy Services'
  AND role    = 'Backend Developer'
  AND is_deleted = FALSE;


-- ------------------------------------------------------------
-- 2. Software Security Analyst
-- ------------------------------------------------------------
-- Same facts as the paragraph it replaces: SAST and DAST, code review of
-- large codebases, 50+ vulnerabilities found early, 10+ live applications
-- tested, fixes validated with the teams, false positives cut, reports
-- written up, vulnerabilities down over time.
UPDATE public.experience
SET description = 'Security analysis on enterprise applications: static and dynamic testing, code review of large codebases, and the follow-through with the teams that had to fix what it found.',
    highlights = ARRAY[
      '50+ vulnerabilities found in large enterprise codebases through static analysis (SAST) and code review, early enough in the development lifecycle to be cheap to fix.',
      '10+ live applications tested dynamically (DAST), which surfaced critical issues that only appear in a running system.',
      'Fixes validated with the development teams and false positives cut, so the reports stayed worth reading.',
      'Findings written up with the detail and the next action a developer needs. The vulnerability count came down over time.'
    ],
    updated_at = NOW()
WHERE company = 'Tata Consultancy Services'
  AND role    = 'Software Security Analyst'
  AND is_deleted = FALSE;


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select role, array_length(highlights, 1) as points,
--          array_length(tech_used, 1) as techs, length(description) as overview
--   from experience where company = 'Tata Consultancy Services' order by sort_order;
--   -> Backend Developer          | 7 | 7 | 486
--      Software Security Analyst  | 4 |   | 174
--
--   As anon, from outside:
--   curl "$SUPABASE_URL/rest/v1/experience?select=role,highlights&apikey=$ANON"
