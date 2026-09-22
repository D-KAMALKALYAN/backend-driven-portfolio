#!/usr/bin/env node
/**
 * Retrieval evaluation (ADR-055): a fixed set of questions, each with the
 * page a good answer would cite first, run against ask_context() as the
 * anon role - lexical only, and hybrid (with the question's embedding).
 * Prints hit@1 and hit@3 for both, and the misses. Run it before and after
 * a retrieval change and put the numbers in the ADR.
 *
 *   npm run ai:eval                      # production (from .env)
 *   npm run ai:eval -- --lexical-only    # no embedding calls
 *   NEXT_PUBLIC_SUPABASE_URL=... npm run ai:eval   # another stack
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and, for the
 * hybrid column, OPENAI_API_KEY (text-embedding-3-small; a run costs well
 * under a cent).
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI = process.env.OPENAI_API_KEY ?? env.OPENAI_API_KEY;
const lexicalOnly = process.argv.includes('--lexical-only') || !OPENAI;
if (!SB || !ANON) { console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing'); process.exit(2); }

/** Each question names the href a good answer cites first; several are accepted where two pages both answer. Phrased as a visitor would, not as the titles read. */
export const QUESTIONS = [
  ['What did Kamal build to help with old codebases?', ['/projects/legacy-code-modernization-assistant']],
  ['Is there a tool that checks websites for security holes?', ['/projects/codeguardian']],
  ['Which project lets people trade skills with each other?', ['/projects/skillverse']],
  ['What is the multi-tenant backend project?', ['/projects/saas-multi-tenant-core-platform']],
  ['Which project is this website itself?', ['/projects/elite-backend-driven-portfolio']],
  ['Which project uses a large language model?', ['/projects/legacy-code-modernization-assistant']],
  ['Why did a database trigger fail silently in production?', ['/writing/the-rate-limit-that-never-fired']],
  ['What went wrong with the authorization check that involved NULL?', ['/writing/coalesce-and-the-policy-that-let-everyone-in']],
  ["Why isn't this site statically generated?", ['/writing/why-every-page-here-renders-per-request']],
  ['How is content cached and invalidated?', ['/how-it-works']],
  ['What is the security model of the site?', ['/how-it-works']],
  ['How does the site decide what runs on the server and what runs in the browser?', ['/how-it-works']],
  ['How are page views collected and rolled up?', ['/how-it-works']],
  ['Where has Kamal worked?', ['/experience']],
  ['What did Kamal do as a security analyst?', ['/experience']],
  ['Does Kamal hold any Azure certification?', ['/about']],
  ["Is Kamal certified on Anthropic's Claude?", ['/about']],
  ['What was the hackathon?', ['/about']],
  ['Tell me about Kamal', ['/about']],
  ['What database does this portfolio run on?', ['/how-it-works', '/projects/elite-backend-driven-portfolio']],
];

async function embed(text) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!r.ok) throw new Error(`embeddings ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).data[0].embedding;
}

async function askContext(q, embedding) {
  const r = await fetch(`${SB}/rest/v1/rpc/ask_context`, {
    method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify({ q, max_docs: 6, ...(embedding ? { q_embedding: embedding } : {}) }),
  });
  if (!r.ok) throw new Error(`ask_context ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).map((d) => d.href);
}

const rankOf = (hrefs, expected) => { const i = hrefs.findIndex((h) => expected.includes(h)); return i === -1 ? null : i + 1; };
const rows = [];
for (const [q, expected] of QUESTIONS) {
  const lex = await askContext(q, null);
  const hyb = lexicalOnly ? null : await askContext(q, await embed(q));
  rows.push({ q, expected, lex: rankOf(lex, expected), hyb: hyb ? rankOf(hyb, expected) : null, lexTop: lex[0] ?? '-', hybTop: hyb?.[0] ?? '-' });
}
const score = (key) => ({ at1: rows.filter((r) => r[key] === 1).length, at3: rows.filter((r) => r[key] !== null && r[key] <= 3).length, miss: rows.filter((r) => r[key] === null).length });
const fmt = (r) => (r === null ? 'miss' : `#${r}`);
console.log(`${'question'.padEnd(78)} lexical  hybrid`);
for (const r of rows) console.log(`${r.q.padEnd(78)} ${fmt(r.lex).padEnd(8)} ${lexicalOnly ? '' : fmt(r.hyb)}${r.lex !== 1 ? `   (lexical top: ${r.lexTop})` : ''}`);
const L = score('lex');
console.log(`\nlexical: hit@1 ${L.at1}/${rows.length}, hit@3 ${L.at3}/${rows.length}, misses ${L.miss}`);
if (!lexicalOnly) { const H = score('hyb'); console.log(`hybrid:  hit@1 ${H.at1}/${rows.length}, hit@3 ${H.at3}/${rows.length}, misses ${H.miss}`); }
