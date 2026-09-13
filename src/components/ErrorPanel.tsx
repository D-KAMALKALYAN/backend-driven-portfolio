'use client';

import Link from 'next/link';

/**
 * What a visitor sees when a route throws. Rendered by app/error.tsx, which
 * is the App Router's error boundary: one thrown exception cannot blank the
 * whole app, and navigating away recovers because each route gets its own.
 *
 * `onError` reporting (Sentry, etc.) belongs in app/error.tsx's effect; this
 * component is deliberately not coupled to a vendor.
 */
export default function ErrorPanel({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div
      role="alert"
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{ backgroundColor: 'var(--bg-subtle)' }}
        aria-hidden="true"
      >
        ⚠
      </div>

      <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Something went wrong on this page
      </h2>

      <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
        The rest of the site is still working. You can retry this section or head back home.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <pre
          className="text-xs text-left max-w-full overflow-x-auto p-3 rounded-lg font-mono"
          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--danger)' }}
        >
          {String(error.stack || error.message || error)}
        </pre>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 rounded-[var(--r-md)] text-sm font-medium cursor-pointer border-none"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-[var(--r-md)] text-sm font-medium no-underline"
          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
