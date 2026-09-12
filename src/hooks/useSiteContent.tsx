'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getVal, getJson, getObject, getItems } from '../utils/siteContent';
import type { JsonObject } from '../utils/json';
import type { Json, SiteContent } from '../types/rows';

/**
 * site_content, read once on the server and handed to every client
 * component through context.
 *
 * History: this began as seven components each fetching the table with no
 * cache, became a context provider, then a TanStack query. Now the rows are
 * in the HTML - the root layout fetches them on the server and provides them
 * here - so there is nothing to fetch, load or fail in the browser. The
 * `loading`/`error` fields stay on the API for the one consumer that still
 * reads them; both are always settled.
 */

export interface SiteContentApi {
  content: SiteContent[];
  loading: false;
  error: null;
  val: (key: string, fallback?: string) => string;
  json: (key: string, fallback?: Json | null) => Json | null;
  object: (key: string) => JsonObject | null;
  items: <T = Json>(key: string, fallback?: T[]) => T[];
}

const SiteContentContext = createContext<SiteContent[] | null>(null);

export function SiteContentProvider({ content, children }: { content: SiteContent[]; children: ReactNode }) {
  return <SiteContentContext.Provider value={content}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent(): SiteContentApi {
  const content = useContext(SiteContentContext);
  if (content === null) {
    throw new Error('useSiteContent must be used inside <SiteContentProvider> (mounted by the root layout)');
  }

  return useMemo(
    () => ({
      content,
      loading: false as const,
      error: null,
      val: (key, fallback = '') => getVal(content, key, fallback),
      json: (key, fallback = null) => getJson(content, key, fallback),
      object: (key) => getObject(content, key),
      items: <T = Json,>(key: string, fallback: T[] = []) => getItems<T>(content, key, fallback),
    }),
    [content],
  );
}
