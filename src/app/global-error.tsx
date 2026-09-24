'use client';

import { useEffect } from 'react';
import { reportClientError } from '../lib/sentryClient';
import ErrorPanel from '../components/ErrorPanel';

/**
 * Last resort: the root layout itself failed (site_content unreachable,
 * for example). Must render its own <html>/<body> because the layout did not.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { void reportClientError(error); }, [error]);

  return (
    <html lang="en">
      {/* Literal colours on purpose: this boundary replaces the root layout,
          so globals.css and its tokens may not be loaded when it renders.
          They mirror --bg-base / --text-primary (dark). */}
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#0a0a0f', color: '#e4e4ef' }}>
        <ErrorPanel error={error} onReset={reset} />
      </body>
    </html>
  );
}
