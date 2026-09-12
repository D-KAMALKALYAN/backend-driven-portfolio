import {
  fetchSiteContent,
  fetchProfile,
  fetchProjects,
  fetchProjectBySlug,
  fetchProjectSections,
  fetchProjectStorytelling,
  fetchExternalProfiles,
  fetchSkills,
  fetchExperience,
  fetchAchievements,
  fetchAnalyticsSummary,
  fetchDailyVisits,
  fetchTopProjects,
  fetchRecentEvents,
} from './api';

/**
 * Every query in one place, as TanStack Query option factories.
 *
 * Query keys are what make caching and deduplication work, so they are
 * defined here rather than typed out at each call site — a key typo would
 * silently create a second cache entry and quietly reintroduce the duplicate
 * fetching this replaces.
 *
 * Replaces the hand-rolled `useSupabaseQuery`, whose caller-supplied `deps`
 * array could not be checked by any lint rule: a wrong deps list was either a
 * stale closure or an infinite loop, with no warning either way.
 */

/** Content changes a few times a month; no need to refetch it on every mount. */
const CONTENT = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
} as const;

/** Analytics is the one thing users expect to move while they watch. */
const LIVE = {
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
} as const;

export const queries = {
  siteContent: () => ({ queryKey: ['site-content'], queryFn: fetchSiteContent, ...CONTENT }),
  profile: () => ({ queryKey: ['profile'], queryFn: fetchProfile, ...CONTENT }),
  skills: () => ({ queryKey: ['skills'], queryFn: fetchSkills, ...CONTENT }),
  experience: () => ({ queryKey: ['experience'], queryFn: fetchExperience, ...CONTENT }),
  achievements: () => ({ queryKey: ['achievements'], queryFn: fetchAchievements, ...CONTENT }),
  externalProfiles: () => ({ queryKey: ['external-profiles'], queryFn: fetchExternalProfiles, ...CONTENT }),
  projects: () => ({ queryKey: ['projects'], queryFn: fetchProjects, ...CONTENT }),

  project: (slug: string | undefined) => ({
    queryKey: ['project', slug],
    // `slug ?? ''` only ever runs when enabled is true, i.e. slug is set.
    queryFn: () => fetchProjectBySlug(slug ?? ''),
    enabled: Boolean(slug),
    ...CONTENT,
  }),

  // Dependent on the project row, so `enabled` gates it rather than the
  // caller returning Promise.resolve([]) for a query it does not want yet.
  projectSections: (projectId: string | undefined) => ({
    queryKey: ['project-sections', projectId],
    queryFn: () => fetchProjectSections(projectId ?? ''),
    enabled: Boolean(projectId),
    ...CONTENT,
  }),

  projectStorytelling: (projectId: string | undefined) => ({
    queryKey: ['project-storytelling', projectId],
    queryFn: () => fetchProjectStorytelling(projectId ?? ''),
    enabled: Boolean(projectId),
    ...CONTENT,
  }),

  analyticsSummary: () => ({ queryKey: ['analytics', 'summary'], queryFn: fetchAnalyticsSummary, ...LIVE }),
  dailyVisits: () => ({ queryKey: ['analytics', 'daily'], queryFn: fetchDailyVisits, ...LIVE }),
  topProjects: (limit = 8) => ({ queryKey: ['analytics', 'top-projects', limit], queryFn: () => fetchTopProjects(limit), ...LIVE }),
  recentEvents: (limit = 20) => ({ queryKey: ['analytics', 'recent', limit], queryFn: () => fetchRecentEvents(limit), ...LIVE }),
};

/**
 * Normalise a TanStack error for `ErrorState`, which renders a string.
 *
 * The old hook stored `err.message`, so passing the Error object straight
 * through would render an object and throw.
 */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message; // PostgrestError is a plain object, not an Error subclass
  }
  return 'An unexpected error occurred';
}
