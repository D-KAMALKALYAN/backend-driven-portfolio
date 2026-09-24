'use client';

import { useEffect } from 'react';
import { reportClientError } from '../lib/sentryClient';
import ErrorPanel from '../components/ErrorPanel';

/**
 * Route-level error boundary. Catches render and data errors from any page
 * below the root layout; the layout, navbar and footer stay up.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The audit found a boundary that caught errors and told nobody. This
    // is the hook it left for a reporter; Sentry is a no-op without a DSN.
    void reportClientError(error);
    console.error('[route error]', error.digest ?? '', error);
  }, [error]);

  return <ErrorPanel error={error} onReset={reset} />;
}
