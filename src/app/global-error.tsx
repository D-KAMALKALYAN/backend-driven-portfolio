'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import ErrorPanel from '../components/ErrorPanel';

/**
 * Last resort: the root layout itself failed (site_content unreachable,
 * for example). Must render its own <html>/<body> because the layout did not.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#0a0a0f', color: '#e4e4ef' }}>
        <ErrorPanel error={error} onReset={reset} />
      </body>
    </html>
  );
}
