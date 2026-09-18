import type { AnalyticsDashboard } from '../types/rows';

/**
 * The queries that still run in the browser, as TanStack Query option
 * factories with centralised keys.
 *
 * Content (projects, profile, skills, ...) no longer appears here: it is
 * read on the server and arrives in the HTML, so there is nothing for the
 * browser to fetch. What remains is the data that is per-visit by nature -
 * analytics - which the visitor expects to move while they watch.
 *
 * It arrives through /api/analytics rather than from PostgREST directly, so
 * the browser needs no database client (ADR-043). One payload, one key: the
 * landing-page teaser and the dashboard share the cache entry, so a visitor
 * who arrives at /analytics from the hero finds it already warm.
 */

/** Analytics is the one thing users expect to move while they watch. */
const LIVE = {
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
} as const;

export async function fetchAnalyticsDashboardFromApi(): Promise<AnalyticsDashboard> {
  const res = await fetch('/api/analytics');
  if (!res.ok) throw new Error(`Analytics unavailable (${res.status})`);
  return (await res.json()) as AnalyticsDashboard;
}

export const queries = {
  analytics: () => ({ queryKey: ['analytics', 'dashboard'], queryFn: fetchAnalyticsDashboardFromApi, ...LIVE }),
};
