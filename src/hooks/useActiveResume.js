import { useQuery } from '@tanstack/react-query';
import { fetchActiveResume } from '../services/api';

/**
 * Single source of truth for the active resume.
 *
 * Both /resume and the landing-page CTA must resolve the resume the same
 * way. Previously each read it independently — the landing page read a
 * hand-maintained site_content key directly — so uploading a new resume
 * could update one and not the other.
 *
 * Backed by the query cache rather than its own effect: Landing and /resume
 * both mount this, so without a shared cache the same row was fetched on
 * every visit to either page.
 *
 * @returns {{ resume: {url,fileName,version,updatedAt}|null, loading: boolean, error: string|null }}
 */
export function useActiveResume() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['resume', 'active'],
    queryFn: fetchActiveResume,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    resume: data ?? null,
    loading: isLoading,
    // Surfaced deliberately: a broken resume link is a real failure, not
    // something to hide behind a fallback. That fallback is what let a
    // missing table go unnoticed for months.
    error: error ? (error.message || 'Could not load resume') : null,
  };
}
