-- ============================================================
-- register_explore_section
--
-- ADR-039: the top navigation shrinks to five items (Home, Projects,
-- Writing, About, Contact) with Resume as the bar's call to action. Skills,
-- Experience, Profiles and Resume move one level down. This registers the
-- `explore` section on About, where they now live: four cards, labels from
-- the same nav.* rows the bar reads. Placed first, before the timeline, so
-- "show me more" is answered before the story is told.
--
-- URLs are unchanged; the footer map and the command palette still list
-- every page.
--
-- SAFE TO RE-RUN.
-- ============================================================

INSERT INTO public.page_sections (page, section_type, heading, description, sort_order, is_visible)
VALUES ('about', 'explore', 'Also here', 'The detail behind this page: skills, experience, profiles and the resume.', 3, TRUE)
ON CONFLICT (page, sort_order) DO NOTHING;
