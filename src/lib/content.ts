import 'server-only';
import { cache } from 'react';
import {
  fetchAchievements,
  fetchActiveResume,
  fetchExperience,
  fetchExternalProfiles,
  fetchProfile,
  fetchProjectBySlug,
  fetchProjectSections,
  fetchProjectStorytelling,
  fetchProjects,
  fetchSiteContent,
  fetchSkills,
} from '../services/api';
import { createServerSupabase } from './supabase/server';

/**
 * Server-side content access, one function per read.
 *
 * `cache()` deduplicates within a request: the root layout, a page and its
 * generateMetadata all ask for site_content, and it is fetched once. Across
 * requests the Data Cache underneath (lib/supabase/server.ts) does the work.
 *
 * Errors propagate. A failed read renders the route's error boundary, not a
 * page quietly missing a section - the pattern that hid the resume outage.
 */

const db = cache(() => createServerSupabase());

export const getSiteContent = cache(() => fetchSiteContent(db()));
export const getProfile = cache(() => fetchProfile(db()));
export const getProjects = cache(() => fetchProjects(db()));
export const getProjectBySlug = cache((slug: string) => fetchProjectBySlug(db(), slug));
export const getProjectSections = cache((projectId: string) => fetchProjectSections(db(), projectId));
export const getProjectStorytelling = cache((projectId: string) => fetchProjectStorytelling(db(), projectId));
export const getExternalProfiles = cache(() => fetchExternalProfiles(db()));
export const getSkills = cache(() => fetchSkills(db()));
export const getExperience = cache(() => fetchExperience(db()));
export const getAchievements = cache(() => fetchAchievements(db()));
export const getActiveResume = cache(() => fetchActiveResume(db()));

/**
 * The project row for a slug, or null. PostgREST's .single() raises
 * PGRST116 for zero rows; that is "not found", not an outage, and the page
 * turns it into a 404 rather than an error boundary.
 */
export const findProjectBySlug = cache(async (slug: string) => {
  try {
    return await getProjectBySlug(slug);
  } catch (err) {
    if (isNoRows(err)) return null;
    throw err;
  }
});

function isNoRows(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'PGRST116';
}
