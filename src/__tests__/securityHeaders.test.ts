import { describe, it, expect } from 'vitest';
import { buildCsp, STATIC_SECURITY_HEADERS } from '../lib/csp';

/**
 * The CSP is only as good as its accuracy. It used to be a static string in
 * vercel.json with a sha256 hash for the one inline script, and two parts of
 * it went stale silently: that hash, and the Supabase origin. It is now a
 * pure function of (nonce, supabaseUrl, isDev), built per request in
 * src/proxy.ts, so the policy itself is asserted here rather than a file.
 */

const SUPABASE = 'https://abcdefghij.supabase.co';
const NONCE = 'dGVzdC1ub25jZQ==';
const csp = buildCsp({ nonce: NONCE, supabaseUrl: SUPABASE });
const directive = (name: string, policy = csp) => policy.match(new RegExp(`(?:^|; )${name} ([^;]*)`))?.[1] ?? '';

describe('Content-Security-Policy', () => {
  it('nonces scripts and relies on strict-dynamic, never unsafe-inline', () => {
    const scriptSrc = directive('script-src');
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('allows unsafe-eval only in development, where React needs it', () => {
    const dev = buildCsp({ nonce: NONCE, supabaseUrl: SUPABASE, isDev: true });
    expect(directive('script-src', dev)).toContain("'unsafe-eval'");
    expect(directive('script-src')).not.toContain("'unsafe-eval'");
  });

  it('names the Supabase origin in every directive that talks to it', () => {
    expect(directive('connect-src')).toContain(SUPABASE);
    expect(directive('img-src')).toContain(SUPABASE);   // cover images from storage
    expect(directive('frame-src')).toContain(SUPABASE); // the resume PDF iframe
  });

  it('allows the realtime websocket', () => {
    // /analytics subscribes to postgres_changes; without wss the socket is
    // blocked and the Live badge silently degrades to Snapshot.
    expect(directive('connect-src')).toContain('wss://abcdefghij.supabase.co');
  });

  it('keeps fonts first-party (self-hosted via next/font)', () => {
    expect(directive('font-src')).toBe("'self'");
    expect(csp).not.toContain('fonts.gstatic.com');
    expect(csp).not.toContain('fonts.googleapis.com');
  });

  it('forbids framing and plugin content', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('tolerates a missing Supabase URL without producing a malformed policy', () => {
    const noSupabase = buildCsp({ nonce: NONCE, supabaseUrl: '' });
    expect(noSupabase).not.toMatch(/\s{2,}/);
    expect(directive('connect-src', noSupabase).trim()).toBe("'self'");
  });
});

describe('static security headers', () => {
  const header = (key: string) => STATIC_SECURITY_HEADERS.find((h) => h.key === key)?.value;

  it('sets the baseline set', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBeTruthy();
    expect(header('Permissions-Policy')).toBeTruthy();
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d+/);
    expect(header('X-Frame-Options')).toBe('DENY');
  });

  it('does not carry the CSP, which must vary per request', () => {
    expect(header('Content-Security-Policy')).toBeUndefined();
  });
});
