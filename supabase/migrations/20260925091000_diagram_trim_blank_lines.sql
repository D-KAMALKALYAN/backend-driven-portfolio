-- ============================================================
-- The diagram gained a blank line at each end
--
-- 20260925090000 embedded the ASCII in a dollar-quoted string written as
--
--   to_jsonb($ascii$
--   browser --GET ...
--   $ascii$::text)
--
-- which is readable in the migration and wrong in the row: the newline
-- after the opening delimiter and the one before the closing delimiter are
-- both part of the string. The stored diagram came out 25 lines instead of
-- 23, with an empty line top and bottom, which the <pre> renders as extra
-- space inside the card.
--
-- btrim with an explicit newline argument rather than trim(): only the line
-- breaks go, and any leading spaces on the first real line - which are load
-- bearing, because they position the flow - stay exactly as they are.
--
-- SAFE TO RE-RUN (idempotent: trimming a trimmed value changes nothing).
-- ============================================================

UPDATE public.page_sections
SET config     = jsonb_set(config, '{ascii}', to_jsonb(btrim(config->>'ascii', E'\n'))),
    updated_at = NOW()
WHERE page = 'how_it_works'
  AND section_type = 'diagram'
  AND config->>'ascii' <> btrim(config->>'ascii', E'\n');


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select array_length(string_to_array(config->>'ascii', E'\n'), 1) as lines
--   from page_sections where page = 'how_it_works' and section_type = 'diagram';
--   -> 23
