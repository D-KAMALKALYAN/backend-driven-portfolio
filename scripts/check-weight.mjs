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
const WITH_ASK = args.includes('--ask');
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

/** Time to the `sources` event: retrieval done, the visitor has something to read. */
async function askFirstByte(question) {
  const start = performance.now();
  const res = await req(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) return { ms: null, note: `HTTP ${res.status}` };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let sourcesMs = null;
  while (sourcesMs === null) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    if (buffered.includes('event: sources')) sourcesMs = Math.round(performance.now() - start);
  }
  await reader.cancel();
  return { ms: sourcesMs, note: sourcesMs === null ? 'no sources event' : '' };
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
  const { ms, note } = await askFirstByte('What does Kamal do at Tata Consultancy Services?');
  console.log(`\nask first byte (sources event): ${ms === null ? note : ms + ' ms'}`);
}
