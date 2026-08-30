import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSiteContent } from '../services/api';
import { getVal, getJson, getItems } from '../utils/siteContent';

/**
 * One fetch of `site_content` for the whole app.
 *
 * Seven consumers previously called fetchSiteContent() independently through
 * useSupabaseQuery, which has no cache and no request deduplication — so the
 * same 56 rows were re-fetched on the landing page, in the footer, in the
 * document-title hook, and again on every navigation to Contact, Resume or
 * the 404 page.
 *
 * The data is effectively static site copy, so it is fetched once at the app
 * root and shared. This is also what makes DB-driven navigation cheap: the
 * navbar reads labels from context rather than issuing its own query.
 */

const SiteContentContext = createContext({
  content: null,
  loading: true,
  error: null,
});

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchSiteContent()
      .then((rows) => {
        if (cancelled) return;
        setContent(rows);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[SiteContent]', err);
        setError(err?.message || 'Could not load site content');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({ content, loading, error }), [content, loading, error]);

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  );
}

/**
 * @returns {{
 *   content: Array|null, loading: boolean, error: string|null,
 *   val: (key: string, fallback?: string) => string,
 *   json: (key: string, fallback?: unknown) => unknown,
 *   items: (key: string, fallback?: Array) => Array,
 * }}
 */
export function useSiteContent() {
  const { content, loading, error } = useContext(SiteContentContext);

  return useMemo(
    () => ({
      content,
      loading,
      error,
      val: (key, fallback = '') => getVal(content, key, fallback),
      json: (key, fallback = null) => getJson(content, key, fallback),
      items: (key, fallback = []) => getItems(content, key, fallback),
    }),
    [content, loading, error],
  );
}
