/**
 * "Popular" is derived, not stored.
 *
 * The schema shipped a `refresh_popular_badges()` function that wrote
 * `meta.is_popular` onto the top three projects, to be run by a daily cron
 * that was never created. Every project's `meta` is `{}`, so the badge it
 * fed has never appeared.
 *
 * The choice was to schedule the function or to delete it. Deleting it is
 * better here: "top N by view_count" is trivially computable from data the
 * list page has already fetched, so storing it buys nothing and costs a
 * scheduler, an extension, and a value that is stale between runs. The
 * `featured` boolean already exists for manual promotion, so nothing is lost.
 *
 * Note this is a *relative* ranking, so it is only meaningful where the whole
 * set is in hand. The project detail page shows an absolute view count
 * instead.
 */

/**
 * Ids of the top `count` projects by view count.
 *
 * Ties are broken by id so the set is stable across renders rather than
 * depending on array order. Projects with no views are never popular — a
 * "popular" badge on something nobody has viewed is worse than no badge.
 *
 * @param {Array<{id: string, view_count?: number}>} projects
 * @param {number} count
 * @returns {Set<string>}
 */
export function getPopularProjectIds(projects, count = 3) {
  if (!Array.isArray(projects) || projects.length === 0) return new Set();

  const ranked = projects
    .filter((p) => p?.id && Number(p.view_count) > 0)
    .sort((a, b) => {
      const diff = Number(b.view_count) - Number(a.view_count);
      return diff !== 0 ? diff : String(a.id).localeCompare(String(b.id));
    })
    .slice(0, Math.max(0, count));

  return new Set(ranked.map((p) => p.id));
}
