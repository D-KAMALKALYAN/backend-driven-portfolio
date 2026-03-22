import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../services/analytics';

/**
 * Automatically fires 'page_view' on every route change.
 * Mount once in AppContent (inside BrowserRouter).
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_view', {
      search: location.search || undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
