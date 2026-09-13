import type { NextConfig } from 'next';
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

export default nextConfig;
