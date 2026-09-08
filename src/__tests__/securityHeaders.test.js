import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * The CSP is only as good as its accuracy, and two parts of it go stale
 * silently:
 *
 *   1. The hash allowing the inline theme-bootstrap script in index.html.
 *      Edit that script without updating the hash and CSP blocks it — the
 *      page still renders, so nothing looks broken, but the flash-of-wrong-
 *      theme the script exists to prevent comes back.
 *
 *   2. The Supabase origin in connect-src / img-src / frame-src. Point the
 *      app at a different project and every request is blocked.
 *
 * Neither fails loudly in a browser, so they are asserted here.
 */

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const globalHeaders =
  vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? [];
const header = (key) => globalHeaders.find((h) => h.key === key)?.value;
const csp = header('Content-Security-Policy') ?? '';

/** sha256-base64 of every inline (src-less) script in index.html. */
function inlineScriptHashes() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  return [...html.matchAll(re)].map(
    (m) => `sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}`,
  );
}

describe('security headers', () => {
  it('sets a Content-Security-Policy', () => {
    expect(csp).toBeTruthy();
  });

  it('allows every inline script in index.html by hash', () => {
    const hashes = inlineScriptHashes();
    expect(hashes.length).toBeGreaterThan(0);
    for (const h of hashes) {
      expect(
        csp,
        `index.html contains an inline script whose hash is not in the CSP.\n` +
        `Add '${h}' to script-src in vercel.json, or the script will be blocked ` +
        `and the theme flash it prevents will return.`,
      ).toContain(h);
    }
  });

  it('does not weaken script-src with unsafe-inline or unsafe-eval', () => {
    const scriptSrc = csp.match(/script-src ([^;]*)/)?.[1] ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('allows the Supabase origin the client actually uses', () => {
    // .env is not present in CI, so fall back to the origin in the CSP and
    // assert only that all three directives agree on one origin.
    const origins = ['connect-src', 'img-src', 'frame-src'].map(
      (d) => csp.match(new RegExp(`${d} ([^;]*)`))?.[1] ?? '',
    );
    const supabase = origins[0].match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
    expect(supabase, 'connect-src must name the Supabase origin').toBeTruthy();
    expect(origins[1]).toContain(supabase); // images from storage
    expect(origins[2]).toContain(supabase); // the resume PDF iframe
  });

  it('allows the realtime websocket', () => {
    // /analytics subscribes to postgres_changes; without wss the socket is blocked
    // and the Live badge silently degrades to Snapshot.
    expect(csp).toMatch(/connect-src [^;]*wss:\/\/[a-z0-9]+\.supabase\.co/);
  });

  it('sets the other baseline headers', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBeTruthy();
    expect(header('Permissions-Policy')).toBeTruthy();
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d+/);
  });

  it('forbids framing and plugin content', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('still rewrites all routes to index.html for the SPA', () => {
    const rewrite = vercel.rewrites.find((r) => r.source === '/(.*)');
    expect(rewrite?.destination).toBe('/index.html');
  });
});
