import { loadSentry, reportClientError, sentryRequested } from './lib/sentryClient';

/**
 * Browser-side error reporting, without the SDK on the critical path
 * (ADR-062).
 *
 * This file used to call `Sentry.init()` here, which put 52.1 kB gzipped on
 * every page for a capability most visits never use. What runs eagerly now
 * is two listeners: the first error the page throws loads the real SDK and
 * hands it that error. After that Sentry's own global handlers are in
 * place, so these stand down rather than reporting everything twice.
 *
 * Events still leave through /monitoring on this origin (tunnelRoute in
 * next.config.ts), so connect-src stays 'self' and blockers that drop
 * *.sentry.io do not drop error reports.
 *
 * `onRouterTransitionStart` is deliberately not exported any more: it feeds
 * navigation spans, and tracesSampleRate has been 0 since ADR-042 - it was
 * a reason to load a tracing SDK that was never going to trace.
 */
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const stopListening = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };

  function handOver(error: unknown) {
    const first = !sentryRequested();
    void reportClientError(error);
    // Only the first one goes through here; from the second, Sentry is
    // either loaded or loading and its own handlers take over.
    if (first) void loadSentry().then(stopListening, stopListening);
  }

  function onError(event: ErrorEvent) {
    handOver(event.error ?? new Error(event.message));
  }

  function onRejection(event: PromiseRejectionEvent) {
    handOver(event.reason);
  }

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
}
