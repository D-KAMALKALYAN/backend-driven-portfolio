-- ============================================================
-- remove_route_probe_rows
--
-- POST /api/contact (the first server-side write path, ADR-032) was
-- verified end to end against production: three messages from
-- route-probe@example.invalid were accepted with 201 and the fourth was
-- rejected with 429 by trg_contact_rate_limit - the SECURITY DEFINER fix
-- from ADR-030 confirmed through the new path. This removes those rows.
--
-- Also removes seo.og_image: the share image is now rendered per URL by
-- next/og from the same rows the page reads, and nothing reads this key.
-- A dead config row is the class of problem the audit's #10 named.
--
-- SAFE TO RE-RUN.
-- ============================================================

DELETE FROM public.contact_messages
WHERE email = 'route-probe@example.invalid';

DELETE FROM public.site_content
WHERE key = 'seo.og_image';

-- POST-CHECK
--   SELECT count(*) FROM contact_messages WHERE email LIKE '%example.invalid';  -- 0
--   SELECT key FROM site_content WHERE key LIKE 'seo.%';  -- title, description, keywords
