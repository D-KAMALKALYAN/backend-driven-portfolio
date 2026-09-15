import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry';

/**
 * Browser-side init. Runs before hydration on every page.
 *
 * Events leave through /monitoring on this origin (tunnelRoute in
 * next.config.ts), so connect-src stays 'self' and ad blockers that drop
 * *.sentry.io requests do not drop error reports.
 */
Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
