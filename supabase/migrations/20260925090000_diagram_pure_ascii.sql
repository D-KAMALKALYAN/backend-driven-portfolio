-- ============================================================
-- "What runs where": an ASCII diagram the font could not draw
--
-- The diagram was built from box-drawing and geometric characters. Measured
-- in the page's own font, at the size the block renders, none of them is one
-- cell wide:
--
--   M 0 space > < v   1.000 cells      (the monospace grid)
--   U+2500  1.552     U+2502  1.369
--   U+25B6  1.436     U+25C0  1.436     U+25BC  2.168
--
-- The font carries no box-drawing coverage, so the browser fell back to
-- another face for every one of those glyphs - and the fallback is not
-- metric-compatible. A run of twenty dashes came out eleven cells too wide,
-- so every line containing an arrow was pushed right relative to the lines
-- above and below it, and the spine of the flow bent.
--
-- Redrawn in characters that are one cell by measurement: - | + > < v. The
-- generator (developer-notes/build-diagram.mjs) computes every column from a
-- single constant and asserts that the spine, both box edges, the tee on the
-- bottom edge and the return arrow all land on it, so this cannot be
-- eyeballed back out of alignment.
--
-- SAFE TO RE-RUN.
-- ============================================================

UPDATE public.page_sections
SET config     = jsonb_set(config, '{ascii}', to_jsonb($ascii$
browser --GET /projects/x--> Vercel edge --> proxy.ts        fresh nonce; CSP header
                                                 |
                                                 v
                                       Next.js server render
                                   +---------------------------+
                                   | layout: site_content      |  cached, tagged table:site_content
                                   | page:   project by slug   |  cached, tagged table:projects
                                   |         sections, story   |  cached, tagged table:project_sections ...
                                   +-------------+-------------+
                                                 |  Data Cache miss?
                                                 v
                                      Supabase PostgREST  (anon key)
                                      Row Level Security decides what is visible
                                                 |
                                                 v
                                   HTML with content, <title>, og:image
                                   every <script> carries the nonce
                                                 |
  <----------------------------------------------+

writes never take this path:
  browser --POST /api/track, /api/contact--> route handler (service role) --> Postgres triggers: rate limits
  Supabase webhook --POST /api/revalidate--> expire tag table:<name>   (an edit is live on the next request)
$ascii$::text)),
    updated_at = NOW()
WHERE page = 'how_it_works'
  AND section_type = 'diagram';


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select config->>'ascii' ~ '[^\x00-\x7F]' as has_non_ascii
--   from page_sections where page = 'how_it_works' and section_type = 'diagram';
--   -> f
