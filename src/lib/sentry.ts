/**
 * One place for what every Sentry runtime (server, edge, browser) shares.
 *
 * Errors only. Tracing and session replay are off: on a portfolio the
 * signal that matters is "a route threw for a visitor and nobody knew",
 * which is exactly what the audit found unaddressed (problem #5). The extra
 * client bundle for performance tooling is not worth it here.
 *
 * With no DSN the SDK is disabled and every capture is a no-op, so a
 * deployment without the variable behaves exactly as before.
 */
export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    // Vercel sets this per deployment; it lets Sentry group errors by build.
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // SENTRY_DEBUG=1 prints every envelope and the ingest response to the
    // server log - the only way to verify delivery from a terminal.
    debug: process.env.SENTRY_DEBUG === '1',
  };
}
