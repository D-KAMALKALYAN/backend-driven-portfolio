'use client';

import { useEffect, useState } from 'react';

/**
 * A GET resource for the browser: fetched on mount, shared between the
 * components that ask for the same URL, refetched when the tab regains
 * focus once it is older than `staleMs`. This is the whole of what the
 * site used TanStack Query for (one query, two readers), written down
 * rather than imported (ADR-048).
 *
 * The cache is module-level and keyed by URL: the landing-page teaser and
 * the analytics dashboard read the same entry, so arriving at /analytics
 * from the hero finds it warm. On the server this module is never
 * evaluated (client hook), so there is no cross-request leak to worry
 * about.
 */
interface Entry { data: unknown; at: number }
const cache = new Map<string, Entry>();

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function useResource<T>(url: string, { staleMs = 30_000, refetchOnFocus = true }: { staleMs?: number; refetchOnFocus?: boolean } = {}): Resource<T> {
  const cached = cache.get(url);
  const [state, setState] = useState<Resource<T>>({
    data: (cached?.data as T | undefined) ?? null,
    error: null,
    loading: !cached,
  });

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    const load = (force: boolean) => {
      const entry = cache.get(url);
      if (!force && entry && Date.now() - entry.at < staleMs) return;
      controller?.abort();
      controller = new AbortController();
      fetch(url, { signal: controller.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return (await r.json()) as T;
        })
        .then((data) => {
          cache.set(url, { data, at: Date.now() });
          if (!cancelled) setState({ data, error: null, loading: false });
        })
        .catch((err: unknown) => {
          if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
          setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err), loading: false }));
        });
    };

    // A fresh cache entry is already in state from the initialiser; only a
    // missing or stale one needs the network.
    load(false);

    const onFocus = () => { if (document.visibilityState === 'visible') load(false); };
    if (refetchOnFocus) {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onFocus);
    }
    return () => {
      cancelled = true;
      controller?.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [url, staleMs, refetchOnFocus]);

  return state;
}
