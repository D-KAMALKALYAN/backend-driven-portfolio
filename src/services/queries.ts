import { supabase } from './supabaseClient';
import {
  fetchAnalyticsSummary,
  fetchDailyVisits,
  fetchTopProjects,
  fetchRecentEvents,
} from './api';

/**
 * The queries that still run in the browser, as TanStack Query option
 * factories with centralised keys.
 *
 * Content (projects, profile, skills, ...) no longer appears here: it is
 * read on the server and arrives in the HTML, so there is nothing for the
 * browser to fetch. What remains is the data that is per-visit by nature -
 * analytics - which the visitor expects to move while they watch.
 */

/** Analytics is the one thing users expect to move while they watch. */
const LIVE = {
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
} as const;

export const queries = {
  analyticsSummary: () => ({ queryKey: ['analytics', 'summary'], queryFn: () => fetchAnalyticsSummary(supabase), ...LIVE }),
  dailyVisits: () => ({ queryKey: ['analytics', 'daily'], queryFn: () => fetchDailyVisits(supabase), ...LIVE }),
  topProjects: (limit = 8) => ({ queryKey: ['analytics', 'top-projects', limit], queryFn: () => fetchTopProjects(supabase, limit), ...LIVE }),
  recentEvents: (limit = 20) => ({ queryKey: ['analytics', 'recent', limit], queryFn: () => fetchRecentEvents(supabase, limit), ...LIVE }),
};

/**
 * Normalise an error for `ErrorState`, which renders a string.
 *
 * PostgrestError is a plain object rather than an Error subclass, so both
 * shapes are handled.
 */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
