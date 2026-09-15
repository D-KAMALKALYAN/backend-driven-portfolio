import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import { STATIC_SECURITY_HEADERS } from './src/lib/csp';

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();

const nextConfig: NextConfig = {
  // No X-Powered-By: nothing a visitor needs, one fewer fingerprint.
  poweredByHeader: false,

  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        // The CSP itself is set per request in src/proxy.ts (it carries a
        // nonce). Everything that does not vary lives here.
        headers: [...STATIC_SECURITY_HEADERS],
      },
    ];
  },
};

/**
 * Sentry's build wrapper does two things here: rewrites /monitoring to the
 * ingest endpoint (so the browser never talks to *.sentry.io directly - the
 * CSP's connect-src stays 'self') and, when SENTRY_AUTH_TOKEN is present,
 * uploads source maps so stack traces name real files. Without the token it
 * skips the upload quietly rather than failing the build; CI and forks have
 * no token and should not need one.
 */
const hasSentryToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: '/monitoring',
  sourcemaps: { disable: !hasSentryToken },
  telemetry: false,
});
