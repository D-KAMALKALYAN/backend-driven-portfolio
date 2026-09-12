'use client';

import { useEffect } from 'react';
import ErrorPanel from '../components/ErrorPanel';

/**
 * Route-level error boundary. Catches render and data errors from any page
 * below the root layout; the layout, navbar and footer stay up.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The single place to wire an error reporter. Deliberately vendor-free.
    console.error('[route error]', error.digest ?? '', error);
  }, [error]);

  return <ErrorPanel error={error} onReset={reset} />;
}
