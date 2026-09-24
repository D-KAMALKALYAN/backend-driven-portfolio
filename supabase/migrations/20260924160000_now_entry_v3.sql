-- ============================================================
-- "Currently" still said v2
--
-- The single now_entries row was written on 2026-09-20 and described the
-- V2 migration - "This portfolio, v2 ... moving a Vite SPA to Next.js",
-- progress "design pass shipped, system check clean". Since then V3 has
-- shipped in full: grounded Ask with citations and streaming, hybrid
-- retrieval, Explain-this, the daily digest, the spend ledger with caps
-- and retention, per-route observability, and the performance pass.
--
-- The section's own guard (NOW_STALE_AFTER_DAYS = 60, utils/now.ts) only
-- protects against an entry nobody has touched: it hides the whole
-- section after sixty days. It cannot tell that a four-day-old row is
-- describing last month's work, and that is exactly what a visitor read.
-- The decay catches abandonment; accuracy is still the owner's to keep.
--
-- Only the row is changed here. No claim is added that the ledger, the
-- checks or the ADRs do not already support:
--   12 steps, PRs #28-#43        -> v3-blueprint.md
--   88 probes green              -> system-check-v3.md
--   196 kB on the wire           -> ADR-062, and check:system enforces it
--
-- SAFE TO RE-RUN.
-- ============================================================

UPDATE public.now_entries
SET title       = 'This portfolio, v3',
    description = 'The site answers questions about itself now: grounded in its own rows, streamed with citations, retrieved by embeddings fused with full-text search. Underneath it, a spend ledger with daily and monthly caps, a 90-day retention rule on the questions, and a request id and timing on every route.',
    progress    = 'v3 shipped - 12 steps, 88 checks green, 196 kB on the wire',
    updated_at  = NOW()
WHERE title = 'This portfolio, v2';


-- ------------------------------------------------------------
-- POST-CHECK
-- ------------------------------------------------------------
--   select title, progress, updated_at from now_entries where is_active;
--   -> This portfolio, v3 | v3 shipped - 12 steps, 88 checks green, 196 kB on the wire
--
-- The heading's "updated <date>" reads from this updated_at, so the page
-- says today rather than 20 Sept.
