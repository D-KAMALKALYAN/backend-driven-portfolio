import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp } from './lib/csp';

/**
 * Per-request CSP nonce. Next.js reads the nonce out of the request's
 * Content-Security-Policy header and attaches it to every script it emits,
 * so nothing else has to know about it except the one hand-written inline
 * script in the root layout, which reads `x-nonce`.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    isDev: process.env.NODE_ENV === 'development',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except Next's own static output, image optimiser, files in
      // /public with an extension, and router prefetches (which carry no HTML).
      source: '/((?!_next/static|_next/image|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
