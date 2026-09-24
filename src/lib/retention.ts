/**
 * How long a visitor's words are kept: raw analytics rows before they are
 * rolled up (ADR-040), and questions in the Ask ledger before they are
 * blanked (ADR-049). One constant, because two places now read it - the
 * daily cron that enforces it, and /api/health, which asks the database
 * whether it has been enforced (ADR-060). A health check against a
 * different number than the cron uses would report on nothing.
 */
export const RETAIN_DAYS = 90;
