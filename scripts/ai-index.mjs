#!/usr/bin/env node
/**
 * Refresh the embeddings index (ADR-055) by asking the site to run its
 * index step - the same code the daily cron runs when content changed, so
 * the keys stay where they live (the deployment). Idempotent: unchanged
 * chunks are not re-embedded; the whole corpus costs a fraction of a cent.
 *
 *   npm run ai:index                              # production, only if stale
 *   npm run ai:index -- --force                   # re-check every chunk
 *   npm run ai:index -- --base http://localhost:3000
 *
 * Needs CRON_SECRET in .env (the deployment's value).
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const args = process.argv.slice(2);
// NEXT_PUBLIC_SITE_URL is deliberately not consulted: in a local .env it is
// http://localhost:3000, so the documented "npm run ai:index -> production"
// quietly asked a dev server instead, which answered 401 with the
// deployment's secret and looked like the secret was wrong.
const base = (args.includes('--base') && args[args.indexOf('--base') + 1]
  ? args[args.indexOf('--base') + 1]
  : process.env.AI_INDEX_BASE ?? 'https://backend-driven-portfolio.vercel.app').replace(/\/$/, '');
const secret = process.env.CRON_SECRET ?? env.CRON_SECRET;
if (!secret) { console.error('CRON_SECRET missing from .env'); process.exit(2); }

const url = `${base}/api/cron/rollup?step=index${args.includes('--force') ? '&force=1' : ''}`;
const r = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
const body = await r.json().catch(() => ({}));
console.log(`${r.status} ${url}`);
console.log(JSON.stringify(body.index ?? body, null, 1));
if (!r.ok) process.exitCode = 1;
