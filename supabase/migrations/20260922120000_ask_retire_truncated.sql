-- ============================================================
-- Retire the answers the model never finished (ADR-051 addendum)
--
-- max_output_tokens on the Responses API counts reasoning tokens as well
-- as the visible text. Ask sent 700; on a broad question the model thought
-- for most of it and had room for three words - "Kamal is not" - which the
-- route recorded as 'answered' and the gate then served from the ledger for
-- a week. The route now reads the response's incomplete state and records
-- such rows as 'failed'; this retires the ones already there.
--
-- An answer the model finished ends a sentence, optionally followed by
-- citations. Anything else, or anything under 60 characters, was cut.
-- 'failed' rows are never cache hits; the tokens and cost stay on the bill.
--
-- SAFE TO RE-RUN.
-- ============================================================
UPDATE public.ask_log
SET status = 'failed'
WHERE status = 'answered'
  AND answer IS NOT NULL
  AND (
    char_length(answer) < 60
    OR btrim(answer) !~ '[.!?)"”'']\s*(\[\d{1,2}\]\s*)*$'
  );

-- POST-CHECK
--   select status, left(answer, 60) from ask_log where char_length(coalesce(answer, '')) < 60;   -- all 'failed'
