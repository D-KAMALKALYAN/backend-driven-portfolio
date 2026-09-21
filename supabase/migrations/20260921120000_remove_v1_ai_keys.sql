-- ============================================================
-- remove the V1 chatbot's configuration
--
-- site_content carried two keys from the first version's assistant widget:
-- `ai.welcome_message` ("Hi, I can explain projects and skills...") and
-- `ai.suggestions` (three canned prompts). Nothing in the codebase has read
-- them since the Next migration, and V3's Ask (ADR-047) takes its
-- suggestions from page_sections, not from here. Dead configuration is
-- removed rather than left to mislead the next reader (ADR-048).
--
-- activity_logs and feature_flags are deliberately NOT touched here:
-- feature_flags becomes the source of SiteFeatures in the next step, and
-- activity_logs is V1 dashboard scaffolding whose contents this app cannot
-- see (no anon SELECT policy) - the owner confirms it is empty before it
-- goes.
--
-- SAFE TO RE-RUN.
-- ============================================================

DELETE FROM public.site_content WHERE key IN ('ai.welcome_message', 'ai.suggestions');
