-- ============================================================
-- remove_verification_rows
--
-- 20260912110000 was verified from outside against production by inserting
-- four contact messages from a probe address and confirming the fourth was
-- rejected. The three that were accepted are test data and should not sit in
-- the inbox once contact notifications exist.
--
-- Narrowly targeted: the address is reserved (.invalid TLD, RFC 2606) and
-- cannot belong to a real sender. SAFE TO RE-RUN.
-- ============================================================

DELETE FROM public.contact_messages
WHERE email = 'ratelimit-probe@example.invalid';
