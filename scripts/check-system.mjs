#!/usr/bin/env node
/**
 * End-to-end system check against a deployment, from outside, with the
 * public key only. This is the 2026-09-19 protocol (developer-notes) made
 * repeatable: deployment + health, every page, security headers, SSR = DB,
 * routes, SEO, and the database boundary as anon.
 *
 *   npm run check:system                 # production
 *   npm run check:system -- http://localhost:3000
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env
 * (read here without dotenv - one line, no dependency). Exit code 1 when
 * anything FAILs; WARNs do not fail the run.
 */
import { readFileSync } from 'node:fs';

const BASE = (process.argv[2] ?? 'https://backend-driven-portfolio.vercel.app').replace(/\/$/, '');
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
// The environment wins over .env, so a local stack can be checked too:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run check:system -- http://localhost:3000
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SB || !ANON) { console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from .env'); process.exit(2); }

const results = [];
const rec = (status, area, name, detail = '') => {
  results.push({ status, area, name, detail });
  console.log(`${status.padEnd(5)} [${area}] ${name}${detail ? '  — ' + detail : ''}`);
};
const pass = (ok, area, name, detail, warn = false) => rec(ok ? 'PASS' : warn ? 'WARN' : 'FAIL', area, name, detail);

// A dropped connection is the checker's, not the site's: one retry before a
// status 0 is allowed to fail a probe (a run once showed three FAILs with
// empty details, all on the checking side).
async function req(url, init = {}, attempt = 0) {
  const t = Date.now();
  try {
    const r = await fetch(url, { redirect: 'manual', ...init, headers: { 'user-agent': 'check-system/1.0', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(40_000) });
    const body = await r.text();
    return { status: r.status, headers: r.headers, body, ms: Date.now() - t };
  } catch (e) {
    if (attempt === 0) { await new Promise((r) => setTimeout(r, 1500)); return req(url, init, 1); }
    return { status: 0, headers: new Headers(), body: String(e), ms: Date.now() - t };
  }
}
const sb = async (path, init = {}) => {
  const r = await req(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  let json = null; try { json = JSON.parse(r.body); } catch { /* not json */ }
  return { ...r, json };
};
const unescapeHtml = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// ---------------- 1. deployment & health ----------------
{
  const r = await req(`${BASE}/api/health`);
  let h = {}; try { h = JSON.parse(r.body); } catch { /* */ }
  pass(r.status === 200 && h.ok === true, 'deploy', 'GET /api/health', `${r.status} ${r.body.slice(0, 160)}`);
  for (const k of ['supabase', 'db', 'serviceRole', 'resend', 'revalidateSecret', 'sentry', 'cronSecret']) pass(h[k] === true, 'deploy', `capability ${k}`, String(h[k]));
  pass(h.env === 'production' || BASE.includes('localhost'), 'deploy', 'env', String(h.env));
  pass(h.flags && typeof h.flags.writing === 'boolean' && typeof h.flags.ask === 'boolean', 'deploy', 'health reports the feature flags', JSON.stringify(h.flags));
  pass(h.ask && typeof h.ask.todayUsd === 'string' && typeof h.ask.dailyCapUsd === 'string' && h.ask.byFeature, 'deploy', 'health reports Ask spend today, this month and per feature', JSON.stringify(h.ask));
  const vid = r.headers.get('x-vercel-id') ?? '';
  if (!BASE.includes('localhost')) pass(vid.includes('hnd1'), 'deploy', 'functions in hnd1 (beside the DB)', vid);
  const samples = [];
  for (let i = 0; i < 5; i++) { const s = await req(`${BASE}/api/health`); try { samples.push(JSON.parse(s.body).dbMs); } catch { /* */ } }
  const sorted = [...samples].sort((a, b) => a - b);
  pass(sorted.length === 5 && sorted[2] < 300, 'deploy', 'server→DB round trip median (ms)', samples.join(' '), true);
  if (h.revalidation) pass(h.revalidation.secretSet === true && h.revalidation.triggers >= 15, 'cache', 'revalidation triggers armed', JSON.stringify(h.revalidation));
  if (h.ask) rec('INFO', 'ai', 'ask spend this month', JSON.stringify(h.ask));
}

// ---------------- 2. pages ----------------
const projects = (await sb('projects?select=slug,title,status&is_deleted=eq.false&order=sort_order')).json ?? [];
const posts = (await sb('posts?select=slug,title,status&order=published_at.desc')).json ?? [];
const pubProjects = projects.filter((p) => p.status === 'published');
const pubPosts = posts.filter((p) => p.status === 'published');
const ROUTES = ['/', '/about', '/projects', '/skills', '/experience', '/profiles', '/resume', '/contact', '/analytics', '/how-it-works', '/writing',
  ...(pubProjects[0] ? [`/projects/${pubProjects[0].slug}`] : []), ...(pubPosts[0] ? [`/writing/${pubPosts[0].slug}`] : [])];
const html = {};
for (const route of ROUTES) {
  const r = await req(`${BASE}${route}`);
  html[route] = r.body;
  const csp = r.headers.get('content-security-policy') ?? '';
  const title = /<title>([^<]*)<\/title>/.exec(r.body)?.[1] ?? '';
  const nonced = (r.body.match(/<script[^>]*nonce="/g) ?? []).length;
  pass(r.status === 200 && title && /'nonce-/.test(csp) && nonced > 0, 'pages', `GET ${route}`, `${r.status} ${r.ms} ms · «${unescapeHtml(title).slice(0, 60)}» · nonced scripts=${nonced}`);
  if (route === '/') {
    const connect = csp.split('connect-src')[1]?.split(';')[0] ?? '';
    pass(/'self'\s+wss:\/\//.test(connect) && !/https:\/\//.test(connect), 'security', "CSP connect-src is 'self' + wss only", connect.trim());
    const script = csp.split('script-src')[1]?.split(';')[0] ?? '';
    pass(script.includes("'strict-dynamic'") && !script.includes("'unsafe-inline'"), 'security', 'CSP script-src nonce + strict-dynamic, no unsafe-inline');
    for (const [k, v] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'strict-origin-when-cross-origin'], ['strict-transport-security', 'max-age=']]) {
      pass((r.headers.get(k) ?? '').includes(v), 'security', `header ${k}`, r.headers.get(k) ?? '');
    }
    const hex = [...new Set(r.body.match(/#[0-9a-f]{6}\b/g) ?? [])].filter((h) => !['#0a0a0f', '#f6f7fb'].includes(h));
    pass(hex.length === 0, 'ui', 'no raw colours in home HTML beyond theme-color metas', hex.join(' ') || 'none', true);
  }
}
{
  const missing = pubProjects.filter((p) => !html['/projects'].includes(unescapeHtml(p.title)) && !html['/projects'].includes(p.title.replace(/&/g, '&amp;')));
  pass(missing.length === 0, 'ssr', `/projects HTML carries all ${pubProjects.length} published titles`, missing.map((p) => p.title).join(', ') || 'all present');
  const drafts = projects.filter((p) => p.status !== 'published' && html['/projects'].includes(p.title));
  pass(drafts.length === 0, 'rls', 'no unpublished project title in /projects HTML', drafts.map((p) => p.title).join(', ') || 'none');
  const missingPosts = pubPosts.filter((p) => !html['/writing'].includes(p.title.replace(/&/g, '&amp;').replace(/'/g, '&#x27;')) && !html['/writing'].includes(p.title));
  pass(missingPosts.length === 0, 'ssr', `/writing HTML carries all ${pubPosts.length} published posts`, missingPosts.map((p) => p.title).join(', ') || 'all present');
  const sections = (await sb('page_sections?select=heading,is_visible&page=eq.how_it_works&order=sort_order')).json ?? [];
  const miss = sections.filter((s) => s.is_visible && s.heading && !html['/how-it-works'].includes(s.heading));
  pass(miss.length === 0, 'ssr', `/how-it-works renders its ${sections.length} registry rows`, miss.map((s) => s.heading).join(', ') || 'all headings present');
  const now = (await sb('now_entries?select=title,progress&is_active=eq.true')).json ?? [];
  for (const n of now) pass(!n.progress || html['/'].includes(unescapeHtml(n.progress)) || html['/'].includes(n.progress), 'cache', `now_entries «${n.title}» progress on home matches DB`, n.progress ?? '');
  pass(/Writing/.test(html['/']), 'ia', 'nav shows Writing (features.writing gate)');
  const r404 = await req(`${BASE}/this-page-does-not-exist`);
  pass(r404.status === 404, 'pages', 'unknown route → 404', String(r404.status));
  // notFound() inside a page. A loading boundary above the segment streams
  // a 200 shell first and the status can no longer change (V3 step 2 found
  // production answering 200 + noindex here); the status is the probe.
  for (const p of ['/projects/this-slug-does-not-exist', '/writing/this-slug-does-not-exist']) {
    const r = await req(`${BASE}${p}`);
    pass(r.status === 404, 'pages', `${p} → 404 (notFound() sets the status)`, String(r.status));
  }
}

// ---------------- 3. routes ----------------
{
  const a = await req(`${BASE}/api/analytics`);
  let an = {}; try { an = JSON.parse(a.body); } catch { /* */ }
  pass(a.status === 200 && an.summary && Array.isArray(an.daily) && Array.isArray(an.topProjects) && Array.isArray(an.recentEvents) && Array.isArray(an.errors) && an.errors.length === 0, 'api', 'GET /api/analytics', `${a.status} ${a.ms} ms visits=${an.summary?.total_visits} daily=${an.daily?.length} top=${an.topProjects?.length} recent=${an.recentEvents?.length}`);
  pass((a.headers.get('cache-control') ?? '').includes('max-age=10'), 'api', '/api/analytics Cache-Control', a.headers.get('cache-control') ?? '', true);
  const s = await req(`${BASE}/api/search?q=postgres`);
  let sr = []; try { sr = JSON.parse(s.body).results; } catch { /* */ }
  pass(s.status === 200 && sr.length > 0, 'api', 'GET /api/search?q=postgres', `${s.status} ${s.ms} ms ${sr.length} results`);
  const s1 = await req(`${BASE}/api/search?q=x`);
  pass(s1.status === 200 && JSON.parse(s1.body).results.length === 0, 'api', 'search ignores a 1-char query');
  pass((await req(`${BASE}/api/revalidate`)).status === 405, 'api', 'GET /api/revalidate → 405');
  pass((await req(`${BASE}/api/revalidate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"table":"posts"}' })).status === 401, 'api', 'POST /api/revalidate without bearer → 401');
  pass((await req(`${BASE}/api/revalidate`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer nope' }, body: '{"table":"posts"}' })).status === 401, 'api', 'POST /api/revalidate wrong bearer → 401');
  pass((await req(`${BASE}/api/cron/rollup`)).status === 401, 'api', 'GET /api/cron/rollup without CRON_SECRET → 401');
  const t = await req(`${BASE}/api/track`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"event":"not_an_event","path":"/"}' });
  pass([400, 422].includes(t.status), 'api', 'POST /api/track rejects an unknown event', String(t.status));
  const c = await req(`${BASE}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"","email":"not-an-email","message":"hi"}' });
  pass([400, 422].includes(c.status), 'api', 'POST /api/contact rejects an invalid payload (no email sent)', String(c.status));
  const ask = await req(`${BASE}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"question":"ab"}' });
  pass([400, 503].includes(ask.status), 'api', 'POST /api/ask rejects a 2-char question (400) or is off (503)', String(ask.status));
  pass((await req(`${BASE}/monitoring`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status !== 404, 'observability', 'Sentry tunnel /monitoring is routed');
  const sm = await req(`${BASE}/sitemap.xml`);
  pass(sm.status === 200 && pubPosts.every((p) => sm.body.includes(`/writing/${p.slug}`)) && pubProjects.every((p) => sm.body.includes(`/projects/${p.slug}`)), 'seo', 'sitemap lists every published project and post', `${(sm.body.match(/<loc>/g) ?? []).length} urls`);
  pass((await req(`${BASE}/robots.txt`)).status === 200, 'seo', 'GET /robots.txt');
  if (pubPosts[0]) {
    const og = await req(`${BASE}/writing/${pubPosts[0].slug}/opengraph-image`);
    pass(og.status === 200 && (og.headers.get('content-type') ?? '').includes('image'), 'seo', 'post OG image renders', `${og.status} ${og.headers.get('content-type')} ${Math.round(og.body.length / 1024)} kB`);
  }
}

// ---------------- 4. database boundary as anon ----------------
{
  const list = await sb('../../storage/v1/object/list/resumes', { method: 'POST', body: '{"prefix":"","limit":100}' });
  pass(Array.isArray(list.json) && list.json.length === 0, 'rls', 'resumes bucket not listable by anon', `${list.status} ${JSON.stringify(list.json)?.slice(0, 60)}`);
  const res = (await sb('resume?select=storage_path&is_active=eq.true&limit=1')).json;
  if (res?.[0]) {
    const pdf = await req(`${SB}/storage/v1/object/public/resumes/${encodeURIComponent(res[0].storage_path)}`);
    pass(pdf.status === 200, 'rls', 'active resume PDF downloads (public path)', `${pdf.status} ${Math.round(pdf.body.length / 1024)} kB`);
  }
  pass([401, 403].includes((await sb('analytics', { method: 'POST', body: '{"event":"page_view","path":"/probe","session_id":"probe"}' })).status), 'rls', 'anon INSERT into analytics refused');
  pass([401, 403].includes((await sb('contact_messages', { method: 'POST', body: '{"name":"p","email":"p@p.io","message":"probe"}' })).status), 'rls', 'anon INSERT into contact_messages refused');
  pass([401, 403].includes((await sb('rpc/ask_begin', { method: 'POST', body: '{"p_ip_hash":"x","p_question":"probe","p_question_norm":"probe"}' })).status), 'rls', 'anon may not call ask_begin');
  pass([401, 403].includes((await sb('rpc/ask_retention', { method: 'POST', body: '{"p_days":90}' })).status), 'rls', 'anon may not call ask_retention');
  pass([401, 403].includes((await sb('rpc/ask_spend', { method: 'POST', body: '{}' })).status), 'rls', 'anon may not call ask_spend');
  const offList = (await sb('rpc/explain_source', { method: 'POST', body: '{"p_table":"ask_log","p_id":"00000000-0000-4000-8000-000000000000"}' })).json;
  pass(Array.isArray(offList) && offList.length === 0, 'ai', 'explain_source() explains nothing off the block-table list', JSON.stringify(offList)?.slice(0, 60));
  const fq = await sb('featured_qa?select=id,question&limit=1');
  pass(fq.status === 200 && Array.isArray(fq.json), 'rls', 'featured_qa readable by anon (only featured rows exist in it)', `${fq.status} ${fq.json?.length ?? '?'} rows`);
  const dg = await sb('digests?select=period_start&order=period_start.desc&limit=1');
  pass(dg.status === 200 && Array.isArray(dg.json), 'rls', 'digests readable by anon', `${dg.status} latest=${dg.json?.[0]?.period_start ?? 'none yet'}`);
  pass([401, 403].includes((await sb('digests', { method: 'POST', body: '{"period_start":"2000-01-01","body":"probe probe probe probe probe"}' })).status), 'rls', 'anon INSERT into digests refused');
  const flags = (await sb('feature_flags?select=key,enabled&order=key')).json ?? [];
  pass(flags.map((f) => f.key).join(',') === 'ask,writing', 'flags', 'feature_flags holds exactly the rows the app reads (ask, writing)', flags.map((f) => `${f.key}=${f.enabled}`).join(' '));
  pass([401, 403, 404].includes((await sb('ask_log?select=id&limit=1')).status) || ((await sb('ask_log?select=id&limit=1')).json ?? []).length === 0, 'rls', 'ask_log invisible to anon');
  pass(((await sb('posts?select=slug&status=neq.published')).json ?? []).length === 0, 'rls', 'draft posts invisible to anon');
  pass(((await sb('projects?select=slug&status=neq.published')).json ?? []).length === 0, 'rls', 'unpublished projects invisible to anon');
  const cutoff = new Date(Date.now() - 91 * 86400e3).toISOString();
  pass(((await sb(`analytics?select=id&created_at=lt.${encodeURIComponent(cutoff)}&limit=1`)).json ?? []).length === 0, 'retention', 'no raw analytics rows older than 91 days', '', true);
  const summ = (await sb('rpc/get_analytics_summary', { method: 'POST', body: '{}' })).json;
  pass(summ && typeof summ.total_visits === 'number', 'retention', 'get_analytics_summary() folds rollups', JSON.stringify(summ)?.slice(0, 80));
  const srch = (await sb('rpc/search_content', { method: 'POST', body: '{"q":"rate limit"}' })).json;
  pass(Array.isArray(srch) && srch.length > 0, 'search', 'search_content() as anon', `${srch?.length} results`);
  const ctx = (await sb('rpc/ask_context', { method: 'POST', body: '{"q":"how does the site cache content?","max_docs":4}' })).json;
  pass(Array.isArray(ctx) && ctx.length > 0 && ctx.every((d) => d.body && d.href), 'ai', 'ask_context() as anon returns full-text sources', `${ctx?.length} sources`);
  const story = (await sb('project_storytelling?select=project_id')).json ?? [];
  const ids = new Set(((await sb('projects?select=id')).json ?? []).map((p) => p.id));
  pass(story.every((s) => ids.has(s.project_id)), 'rls', 'storytelling rows only for visible projects', `${story.length} rows`);
}

const counts = results.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
console.log('\nSUMMARY', JSON.stringify(counts));
process.exit(counts.FAIL ? 1 : 0);
