import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queries } from '../services/queries';
import { getVal, getJson, getItems } from '../utils/siteContent';

/**
 * Accessors for site_content, backed by one shared query.
 *
 * This was a context provider, introduced because seven components each
 * called fetchSiteContent() through a hook with no cache and no request
 * deduplication. TanStack Query solves that generically: every consumer of
 * the same query key shares one in-flight request and one cache entry, so
 * the provider is no longer earning its place and has been removed.
 *
 * Keeping the hook (rather than calling useQuery at each site) is worth it
 * for the val/json/items helpers — the alternative is repeating
 * `getVal(content, key, fallback)` in a dozen components.
 */

/**
 * @returns {{
 *   content: Array|null, loading: boolean, error: string|null,
 *   val: (key: string, fallback?: string) => string,
 *   json: (key: string, fallback?: unknown) => unknown,
 *   items: (key: string, fallback?: Array) => Array,
 * }}
 */
export function useSiteContent() {
  const { data: content, isLoading, error } = useQuery(queries.siteContent());

  return useMemo(
    () => ({
      content: content ?? null,
      loading: isLoading,
      error: error ? (error.message ?? 'Could not load site content') : null,
      val: (key, fallback = '') => getVal(content, key, fallback),
      json: (key, fallback = null) => getJson(content, key, fallback),
      items: (key, fallback = []) => getItems(content, key, fallback),
    }),
    [content, isLoading, error],
  );
}
