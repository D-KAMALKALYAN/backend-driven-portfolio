'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '../services/analytics';

/**
 * Automatically fires 'page_view' on every genuine route change.
 * Mount once in AppContent (inside BrowserRouter).
 *
 * The `trackedRef` guard prevents React StrictMode's intentional
 * double-mount (mount → unmount → remount) from firing two events
 * for the same path. The ref resets whenever the pathname actually changes.
 */
export function usePageTracking() {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const trackedRef = useRef<string | null>(null); // last pathname we successfully tracked

  useEffect(() => {
    // Skip if this exact path was already tracked in this effect cycle.
    // React StrictMode fires effects twice with the same pathname;
    // a real navigation will have a different pathname, so it always fires.
    if (trackedRef.current === pathname) return;
    trackedRef.current = pathname;

    const search = searchParams?.toString() ?? '';
    trackEvent('page_view', {
      search: search ? `?${search}` : undefined,
    });
  // Search-param changes (project filters) are not new page views.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
