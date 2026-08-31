import { useEffect, useState } from 'react';
import { fetchActiveResume } from '../services/api';

/**
 * Single source of truth for the active resume.
 *
 * Both /resume and the landing-page CTA must resolve the resume the same
 * way. Previously each read it independently — the landing page read a
 * hand-maintained site_content key directly — so uploading a new resume
 * could update one and not the other.
 *
 * @returns {{ resume: {url,fileName,version,updatedAt}|null, loading: boolean, error: string|null }}
 */
export function useActiveResume() {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchActiveResume()
      .then((r) => {
        if (cancelled) return;
        setResume(r);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Surfaced deliberately: a broken resume link is a real failure,
        // not something to hide behind a fallback.
        console.error('[useActiveResume]', err);
        setError(err?.message || 'Could not load resume');
        setResume(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { resume, loading, error };
}
