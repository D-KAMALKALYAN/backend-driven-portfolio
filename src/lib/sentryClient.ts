import { sentryOptions } from './sentry';

/**
 * The browser's error reporter, loaded on the first error rather than on
 * every page load (ADR-062).
 *
 * Measured on a production build: initialising `@sentry/nextjs` at the top
 * of `instrumentation-client.ts` costs **52.1 kB gzipped on every page** -
 * 21% of what the site ships - and the overwhelming majority of visits
 * never throw anything. So the SDK moves behind a dynamic import: a visitor
 * who has no error downloads none of it, and a visitor who does pays for it
 * once, after the thing that mattered has already gone wrong.
 *
 * What is given up: an error thrown while the SDK is still arriving is
 * reported late, and an error severe enough to break `import()` itself is
 * not reported at all. That is the same trade the palette makes with
 * framer-motion (ADR-056), and it is worth making twice - a reporter that
 * slows down every working page to be ready for the rare broken one is
 * paying the wrong visitor's bill.
 *
 * `Sentry.init()` runs exactly once, inside the import, and is idempotent
 * after that because the promise is cached.
 */
type SentryModule = typeof import('@sentry/nextjs');

let pending: Promise<SentryModule> | null = null;

export function loadSentry(): Promise<SentryModule> {
  pending ??= import('@sentry/nextjs').then((Sentry) => {
    Sentry.init(sentryOptions());
    return Sentry;
  });
  return pending;
}

/** True once the SDK is on its way: the early handlers stand down at that point, because Sentry installs its own. */
export function sentryRequested(): boolean {
  return pending !== null;
}

/**
 * Report an error, fetching the SDK if this is the first one. Never throws
 * and never rejects: a failure to report is not a second failure for the
 * visitor to suffer.
 */
export async function reportClientError(error: unknown, extra?: Record<string, unknown>): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = await loadSentry();
    Sentry.captureException(error, extra ? { extra } : undefined);
    // The page may be closing - a navigation away from a broken page is the
    // common case - so the envelope is pushed rather than left queued.
    await Sentry.flush(2000);
  } catch {
    /* reporting an error must not become one */
  }
}
