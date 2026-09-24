#!/usr/bin/env node
/**
 * What a visitor actually waits for and actually downloads, per page
 * (ADR-062, blueprint Phase 9 step 11).
 *
 *   npm run check:weight                      # production
 *   npm run check:weight -- http://localhost:3000
 *   npm run check:weight -- --ask             # also time Ask's first byte (spends)
 *
 * Two numbers were in circulation for "JS on the wire" and they disagreed
 * by 30 kB: Next's build report ("First Load JS", an estimate attributed to
 * a route) and a count of what the page actually references. This script is
 * the second, and it is the one this project quotes from now on, because it
 * is the only one a browser could disagree with:
 *
 *   - every distinct <script src> in the rendered HTML, fetched, gzipped
 *     here at a fixed level so two runs are comparable whatever the CDN
 *     negotiates;
 *   - TTFB, as the time to the first byte of the document, median of five,
 *     because a per-request render's first byte is the number the design
 *     trades for (ADR-014);
 *   - with --ask, the time to the `sources` event on POST /api/ask - the
 *     moment the visitor first sees something. It costs a question against
 *     the daily cap, so it is off by default.
 *
 * A dropped connection is the checker's, not the site's: every request gets
 * two retries before its number is allowed to be a failure.
 */
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const WITH_ASK = args.some((a) => a === '--ask' || a.startsWith('--ask='));
const BASE = (args.find((a) => !a.startsWith('--')) ?? 'https://backend-driven-portfolio.vercel.app').replace(/\/$/, '');
const PAGES = ['/', '/projects', '/experience', '/skills', '/about', '/contact', '/analytics', '/how-it-works', '/writing', '/resume'];

/** Gzip level 6 is node's default and zlib's; fixed here so it is a decision, not a default that could move. */
const GZIP = { level: 6 };

async function req(url, init = {}, attempt = 0) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return req(url, init, attempt + 1);
    }
    throw err;
  }
}

/** Time to the document's first byte, not to its last: the rest is streamed. */
async function ttfb(url) {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const res = await req(url, { cache: 'no-store' });
    const reader = res.body?.getReader();
    if (reader) { await reader.read(); await reader.cancel(); }
    samples.push(Math.round(performance.now() - start));
  }
  return samples.sort((a, b) => a - b)[2];
}

async function weigh(path) {
  const html = await (await req(BASE + path)).text();
  const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
  let bytes = 0;
  for (const src of srcs) {
    const res = await req(src.startsWith('http') ? src : BASE + src);
    bytes += gzipSync(Buffer.from(await res.arrayBuffer()), GZIP).byteLength;
  }
  return { scripts: srcs.length, kb: bytes / 1024, ttfbMs: await ttfb(BASE + path) };
}

/**
 * Time to the first event on the stream, and which event it was. A fresh
 * question sends `sources` once retrieval is done; a repeat inside the
 * cache window sends `done` straight away and never sends `sources` at all
 * (ADR-047). Waiting only for `sources` therefore measured nothing on a
 * cached question, which is the common case for any question asked twice.
 */
async function askFirstByte(question) {
  const start = performance.now();
  const res = await req(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) return { ms: null, kind: `HTTP ${res.status}` };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const match = buffered.match(/event: (\w+)/);
      if (match) {
        const kind = match[1];
        return {
          ms: Math.round(performance.now() - start),
          kind: kind === 'sources' ? 'sources (fresh: retrieval done)'
            : kind === 'done' ? 'done (cached: no model call)'
            : kind,
        };
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return { ms: null, kind: 'stream ended with no event' };
}

console.log(`${BASE}\n`);
console.log('page                scripts   JS (gzip)   TTFB p50');
console.log('─'.repeat(54));
let worst = 0;
for (const path of PAGES) {
  try {
    const { scripts, kb, ttfbMs } = await weigh(path);
    worst = Math.max(worst, kb);
    console.log(`${path.padEnd(20)}${String(scripts).padStart(4)}   ${kb.toFixed(1).padStart(8)} kB   ${String(ttfbMs).padStart(5)} ms`);
  } catch (err) {
    console.log(`${path.padEnd(20)}  FAILED  ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log('─'.repeat(54));
console.log(`heaviest page: ${worst.toFixed(1)} kB`);

if (WITH_ASK) {
  // --ask="..." to measure a question the ledger has not answered recently;
  // the default will usually come back cached, which is its own useful number.
  const asked = args.find((a) => a.startsWith('--ask='))?.slice('--ask='.length)
    || 'What does Kamal do at Tata Consultancy Services?';
  const { ms, kind } = await askFirstByte(asked);
  console.log(`\nask first byte: ${ms === null ? '-' : ms + ' ms'}  [${kind}]`);
  console.log(`  question: ${asked}`);
}
