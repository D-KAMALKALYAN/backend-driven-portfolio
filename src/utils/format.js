/**
 * Formats a project view count for display.
 *
 * Shows the exact number rather than a rounded "N+ views" bucket, so the
 * figure matches what the analytics dashboard reports.
 *
 * Returns null when there is nothing worth showing (0, null, or a
 * non-finite value) so callers can omit the badge entirely — rendering
 * "0 views" adds no information.
 *
 * @param {number|null|undefined} count
 * @returns {string|null} e.g. "1 view", "45 views", "1.2k views"
 */
export function formatViews(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 1) return null;

  if (n >= 1000) {
    const k = (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '');
    return `${k}k views`;
  }

  return `${n.toLocaleString()} ${n === 1 ? 'view' : 'views'}`;
}
