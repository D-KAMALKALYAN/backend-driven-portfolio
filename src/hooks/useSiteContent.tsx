import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queries } from '../services/queries';
import { getVal, getJson, getObject, getItems } from '../utils/siteContent';
import type { JsonObject } from '../utils/json';
import { errorMessage } from '../services/queries';
import type { Json, SiteContent } from '../types/rows';

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

export interface SiteContentApi {
  content: SiteContent[] | null;
  loading: boolean;
  error: string | null;
  val: (key: string, fallback?: string) => string;
  json: (key: string, fallback?: Json | null) => Json | null;
  object: (key: string) => JsonObject | null;
  items: <T = Json>(key: string, fallback?: T[]) => T[];
}

export function useSiteContent(): SiteContentApi {
  const { data: content, isLoading, error } = useQuery(queries.siteContent());

  return useMemo(
    () => ({
      content: content ?? null,
      loading: isLoading,
      error: error ? (errorMessage(error) ?? 'Could not load site content') : null,
      val: (key, fallback = '') => getVal(content, key, fallback),
      json: (key, fallback = null) => getJson(content, key, fallback),
      object: (key) => getObject(content, key),
      items: <T = Json,>(key: string, fallback: T[] = []) => getItems<T>(content, key, fallback),
    }),
    [content, isLoading, error],
  );
}
