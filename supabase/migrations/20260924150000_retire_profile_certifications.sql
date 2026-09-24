-- ============================================================
-- profiles.meta.certifications: a second copy that had already drifted
--
-- The About page rendered a prose "Certifications" card from
-- `profiles.meta.certifications`, directly above the "Certifications &
-- Awards" section it renders from the `achievements` table. Two sources
-- for one fact, one of them hand-written - so it drifted, exactly as that
-- arrangement always does:
--
--   meta.certifications : "Microsoft Certified: Azure AI Engineer Associate
--                          (2025). Hackathon participant, Lumen
--                          Technologies (2023) ..."
--   achievements        : Claude Certified Associate - Foundations (Anthropic, 2026-09-20)
--                         Microsoft Certified: Azure AI Engineer Associate (2025-08-01)
--                         Hackathon Participant - Lumen Technologies (2023-02-01)
--
-- The credential earned most recently was missing from the copy a visitor
-- read first. The card is gone from the page; this removes the key so
-- nobody maintains a field that renders nowhere, and `achievements` is the
-- only place a credential is written.
--
-- The rest of `meta` stays: philosophy, approach, interests, education and
-- focus_area are prose with no table behind them, which is what the escape
-- hatch is for.
--
-- SAFE TO RE-RUN (removing an absent key is a no-op).
-- ============================================================

UPDATE public.profiles
SET meta       = meta - 'certifications',
    updated_at = NOW()
WHERE meta ? 'certifications';


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select jsonb_object_keys(meta) from profiles where is_active;
--   -> focus_area, years_experience, philosophy, approach, interests, education
--      (no certifications)
--
--   select count(*) from achievements where type = 'certification';   -- 2
