'use client';

import ErrorPanel from '../components/ErrorPanel';

/**
 * Last resort: the root layout itself failed (site_content unreachable,
 * for example). Must render its own <html>/<body> because the layout did not.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#0a0a0f', color: '#e4e4ef' }}>
        <ErrorPanel error={error} onReset={reset} />
      </body>
    </html>
  );
}
