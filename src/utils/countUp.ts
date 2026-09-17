/**
 * The maths behind an animated counter, kept pure so it is testable
 * without a frame loop.
 */

/** Ease-out cubic: fast start, settles gently onto the final value. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** The value to show `elapsedMs` into a `durationMs` animation towards `target`. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  if (durationMs <= 0 || elapsedMs >= durationMs) return target;
  return Math.round(target * easeOutCubic(elapsedMs / durationMs));
}
