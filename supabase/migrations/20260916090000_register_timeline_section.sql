-- ============================================================
-- register_timeline_section
--
-- The `timeline` section type (ADR-036 registry): roles, projects and
-- credentials merged into one chronology, newest first, with year markers.
-- Derived from experience, projects and achievements - no new table, nothing
-- to keep in sync. Registered on About ahead of the endorsements block.
--
-- SAFE TO RE-RUN.
-- ============================================================

INSERT INTO public.page_sections (page, section_type, heading, description, sort_order, is_visible)
VALUES ('about', 'timeline', 'The story so far', 'Roles, projects and credentials on one line, newest first.', 5, TRUE)
ON CONFLICT (page, section_type) DO NOTHING;
