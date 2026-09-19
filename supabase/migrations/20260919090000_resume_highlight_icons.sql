-- ============================================================
-- resume highlight icons
--
-- site_content['resume.highlights'].value_json.items[].icon carried the
-- emoji the first version used as icons (🔒 🏗 🛠 ☁️). The resume page
-- now renders icons by name through components/Icon.tsx and shows any
-- other string as text - which is exactly what the 2026-09-19 UI check
-- saw: four emoji on an otherwise icon-consistent page. This maps the
-- four known glyphs to their names and leaves anything else alone. A
-- name the registry does not know still renders as text, so this cannot
-- blank a highlight.
--
-- SAFE TO RE-RUN (idempotent: names map to themselves).
-- ============================================================

UPDATE public.site_content
SET value_json = jsonb_set(
  value_json,
  '{items}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(item) = 'object' AND item ? 'icon' THEN
          jsonb_set(item, '{icon}', to_jsonb(
            CASE replace(item->>'icon', E'️', '')
              WHEN E'\U0001F512' THEN 'lock'      -- 🔒
              WHEN E'\U0001F3D7' THEN 'building'  -- 🏗
              WHEN E'\U0001F6E0' THEN 'wrench'    -- 🛠
              WHEN E'☁'     THEN 'cloud'     -- ☁
              ELSE item->>'icon'
            END
          ))
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(value_json->'items') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE key = 'resume.highlights'
  AND jsonb_typeof(value_json->'items') = 'array';


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select jsonb_path_query_array(value_json, '$.items[*].icon') from site_content where key = 'resume.highlights';
--   -> ["lock", "building", "wrench", "cloud"]
