-- ============================================================
-- experience: the role titles and the dates the owner actually worked
--
-- Corrections from the owner, 2026-09-24:
--   "Backend Developer"         -> "Software Engineer - Backend Developer",
--                                  Nov 2024 to present (was Jan 2026)
--   "Software Security Analyst" -> May 2024 to Oct 2024 (was May 2024 to Jan 2026)
--
-- The two roles no longer meet at Jan 2026: the security role ended in
-- October 2024 and the backend one began in November. Everything derived
-- from these dates moves with them - the hero's career line
-- (utils/career.ts reads the earliest start, which is unchanged at May
-- 2024, so "2+ years experience" still holds), the timeline order, and the
-- "Current" badge.
--
-- RENAMING A ROLE IS NOT FREE. content_chunks' RLS policy matches a chunk
-- to its row by `e.role = content_chunks.title` (ADR-055), and ask_corpus()
-- keys an experience document the same way. A chunk indexed under the old
-- title stops being readable by anyone the moment the title changes - not
-- an error, just silence in /ask. So the experience chunks are deleted
-- here: the content change already marks the index stale, the daily cron
-- re-embeds both roles under their new titles, and lexical retrieval
-- (search_content, 20260924100000) answers in the meantime because it
-- reads the table rather than the index.
--
-- Matching on the OLD title means a second run finds nothing, which is
-- correct: this is a correction, not a state to converge on.
--
-- SAFE TO RE-RUN.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The backend role: new title, and it started a year earlier
-- ------------------------------------------------------------
UPDATE public.experience
SET role       = 'Software Engineer - Backend Developer',
    start_date = DATE '2024-11-01',
    end_date   = NULL,
    is_current = TRUE,
    updated_at = NOW()
WHERE company = 'Tata Consultancy Services'
  AND role    = 'Backend Developer'
  AND is_deleted = FALSE;


-- ------------------------------------------------------------
-- 2. The security role: it ended in October 2024
-- ------------------------------------------------------------
-- current_implies_no_end holds: is_current FALSE with an end date.
UPDATE public.experience
SET start_date = DATE '2024-05-01',
    end_date   = DATE '2024-10-31',
    is_current = FALSE,
    updated_at = NOW()
WHERE company = 'Tata Consultancy Services'
  AND role    = 'Software Security Analyst'
  AND is_deleted = FALSE;


-- ------------------------------------------------------------
-- 3. The chunks that were indexed under the old title
-- ------------------------------------------------------------
-- Both roles, not just the renamed one: the other's body changed with its
-- dates, and re-embedding two documents costs a fraction of a cent.
DELETE FROM public.content_chunks WHERE kind = 'experience';


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select role, start_date, end_date, is_current from experience
--   where company = 'Tata Consultancy Services' order by sort_order;
--   -> Software Engineer - Backend Developer | 2024-11-01 |            | t
--      Software Security Analyst             | 2024-05-01 | 2024-10-31 | f
--
--   select kind, count(*) from content_chunks group by kind;   -- no 'experience' row
--   select ask_index_state();                                  -- stale: true, until the cron runs
