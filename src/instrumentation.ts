import * as Sentry from '@sentry/nextjs';

/**
 * Next.js calls register() once per server runtime at startup, and
 * onRequestError for every error thrown while handling a request - route
 * handlers, server components, metadata. That second hook is what the
 * client-side error boundaries could never see: an exception in
 * /api/contact happened on a server nobody was watching.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
