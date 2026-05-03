import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  const location  = useLocation();
  const trackedRef = useRef(null); // last pathname we successfully tracked

  useEffect(() => {
    // Skip if this exact path was already tracked in this effect cycle.
    // React StrictMode fires effects twice with the same pathname;
    // a real navigation will have a different pathname, so it always fires.
    if (trackedRef.current === location.pathname) return;
    trackedRef.current = location.pathname;

    trackEvent('page_view', {
      search: location.search || undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
