/**
 * Content-Security-Policy, built per request.
 *
 * The Vite build shipped a static CSP with a sha256 hash for the one inline
 * script (theme bootstrap). Next.js emits its own inline scripts on every
 * page - the RSC payload - whose content varies per request, so a hash cannot
 * cover them. The choices were a per-request nonce with 'strict-dynamic',
 * or 'unsafe-inline' for scripts. The second disables the one thing a CSP is
 * for on the script axis, so it is the nonce.
 *
 * The cost of the nonce is that every page is rendered per request: a nonce
 * baked into a static HTML file would not be a nonce. Data is still cached
 * (see lib/supabase/server.ts), so the render itself is milliseconds; what is
 * given up is CDN caching of the HTML. Recorded in ADR-032.
 *
 * Kept as a pure function so the policy is unit-testable without a server.
 */

export interface CspOptions {
  nonce: string;
  supabaseUrl: string;
  isDev?: boolean;
}

export function buildCsp({ nonce, supabaseUrl, isDev = false }: CspOptions): string {
  const supabaseOrigin = originOf(supabaseUrl);
  const supabaseWs = supabaseOrigin.replace(/^https:/, 'wss:');

  // Each directive is a list of sources; empties (no Supabase origin
  // configured) drop out rather than leaving double spaces in the header.
  const d = (name: string, ...sources: Array<string | false>) =>
    [name, ...sources.filter((x): x is string => Boolean(x))].join(' ');

  const directives = [
    d('default-src', "'self'"),
    // 'strict-dynamic' lets the nonced Next runtime load its own chunks and
    // makes the host allowlist irrelevant for scripts. 'unsafe-eval' is
    // development-only: React's dev tooling reconstructs server stacks with
    // it; production uses neither.
    d('script-src', "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", isDev && "'unsafe-eval'"),
    // Inline styles remain: framer-motion and ~250 style={{}} props write
    // them. That was already the case on Vite and is a known, accepted gap.
    d('style-src', "'self'", "'unsafe-inline'"),
    // Fonts are self-hosted through next/font, so no external font origin.
    d('font-src', "'self'"),
    d('img-src', "'self'", 'data:', 'blob:', supabaseOrigin),
    d('connect-src', "'self'", supabaseOrigin, supabaseWs),
    // The resume PDF is embedded from Supabase storage.
    d('frame-src', "'self'", supabaseOrigin),
    d('object-src', "'none'"),
    d('base-uri', "'self'"),
    d('form-action', "'self'"),
    d('frame-ancestors', "'none'"),
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ];

  return directives.join('; ');
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/** Security headers that do not vary per request. Applied via next.config. */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];
