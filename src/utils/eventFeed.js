/**
 * Groups raw analytics rows into one entry per visit for display.
 *
 * A single visit to a project page writes two rows — `page_view` when the
 * route changes, then `project_view` once the project has loaded, roughly a
 * second later. Both are intentional and mean different things, but rendered
 * as separate lines with minute-granularity timestamps they are
 * indistinguishable from duplicates. That presentation is what made the
 * analytics feed look broken.
 *
 * This groups by (session, path) within a short window so one visit reads as
 * one entry, with its sub-events shown as tags. The underlying rows are not
 * altered — this is a display concern only.
 */

/** Events within this window on the same path/session belong to one visit. */
const VISIT_WINDOW_MS = 30_000;

function timeOf(row) {
  const t = row?.created_at ? new Date(row.created_at).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
}

/**
 * @param {Array} rows analytics rows, newest first
 * @returns {Array<{id: string, path: string, events: string[], at: number|null, count: number}>}
 */
export function groupEventsByVisit(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const groups = [];

  for (const row of rows) {
    if (!row || !row.event) continue;
    const path = row.path || '/';
    const session = row.session_id ?? null;
    const at = timeOf(row);

    // Match the most recent open group for this session+path still inside the
    // window. Rows arrive newest-first, so only the latest group can match.
    const match = groups.find(
      (g) =>
        g.path === path &&
        g.session === session &&
        at !== null &&
        g.at !== null &&
        Math.abs(g.at - at) <= VISIT_WINDOW_MS,
    );

    if (match) {
      if (!match.events.includes(row.event)) match.events.push(row.event);
      match.count += 1;
      // Keep the newest timestamp as the group's time.
      if (at !== null && (match.at === null || at > match.at)) match.at = at;
      continue;
    }

    groups.push({
      id: row.id ?? `${path}-${at ?? groups.length}`,
      path,
      session,
      events: [row.event],
      at,
      count: 1,
    });
  }

  return groups;
}

/**
 * Time label for a feed row. Includes seconds, because minute precision made
 * two genuinely separate visits render as an identical pair.
 */
export function formatEventTime(at) {
  if (at === null || at === undefined) return '—';
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
