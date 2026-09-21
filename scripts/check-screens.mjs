#!/usr/bin/env node
/**
 * Full-page screenshots of every route in both themes, six routes at phone
 * width, and the interactive states (mobile menu, palette search, experience
 * drawer, project filter, skills filter, contact validation). Per capture it
 * records console errors, failed requests, and a11y basics (one h1, lang,
 * imgs without alt, horizontal overflow, skip link) into report.json.
 *
 *   npm run check:screens -- <outDir> [baseUrl]
 *   npm run check:screens -- shots/after http://localhost:3000
 *
 * Launches headless Chrome itself (CHROME_PATH overrides the default
 * locations) with remote debugging on 9427, and closes it at the end.
 * Compare two runs with `npm run check:diff -- <before> <after> <out>`.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [outDir, baseArg] = process.argv.slice(2);
if (!outDir) { console.error('usage: check-screens <outDir> [baseUrl]'); process.exit(2); }
const BASE = (baseArg ?? 'https://backend-driven-portfolio.vercel.app').replace(/\/$/, '');
const PORT = 9427;
mkdirSync(outDir, { recursive: true });

const CHROME = process.env.CHROME_PATH ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!CHROME) { console.error('Chrome not found; set CHROME_PATH'); process.exit(2); }
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), 'check-screens-profile')}`, '--window-size=1280,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore', detached: false });
const stop = () => { try { chrome.kill(); } catch { /* */ } };
process.on('exit', stop);

let targets = [];
for (let i = 0; i < 50 && !targets.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { /* */ } if (!targets.length) await new Promise((r) => setTimeout(r, 300)); }
const page = targets.find((t) => t.type === 'page');
if (!page) { console.error('Chrome did not expose a page target'); stop(); process.exit(2); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r));
let errs = [], failed = [], reqs = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? '').slice(0, 200));
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errs.push(m.params.type.toUpperCase() + ' ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('LOG ' + m.params.entry.text.slice(0, 200));
  if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, m.params.request.url);
  if (m.method === 'Network.loadingFailed' && !/ERR_ABORTED/.test(m.params.errorText)) failed.push(`${(reqs.get(m.params.requestId) ?? '?').slice(0, 120)} :: ${m.params.errorText}`);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) failed.push(`${m.params.response.url.slice(0, 120)} :: HTTP ${m.params.response.status}`);
});
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
const ev = (expr) => send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: expr }).then((r) => r?.result?.value);
const setReactValue = (sel, val) => `(() => { const i = document.querySelector('${sel}'); if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`;
const A11Y = `(() => { const imgs = [...document.images]; return { h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, title: document.title, imgsNoAlt: imgs.filter(i => !i.hasAttribute('alt')).length, imgs: imgs.length, skip: !!document.querySelector('a[href="#main-content"]'), main: !!document.querySelector('main#main-content'), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth } })()`;

const report = [];
async function shoot(name, path, { width = 1280, theme = 'dark', mobile = false, before = null, wait = 3000 } = {}) {
  errs = []; failed = []; reqs = new Map();
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url: BASE + path });
  await new Promise((r) => setTimeout(r, wait));
  await ev(`localStorage.setItem('theme', '${theme}'); document.documentElement.setAttribute('data-theme', '${theme}');`);
  await new Promise((r) => setTimeout(r, 400));
  if (before) { await ev(before); await new Promise((r) => setTimeout(r, 1500)); }
  const a11y = (await ev(A11Y)) ?? {};
  const h = Math.min(7000, (await ev('document.documentElement.scrollHeight')) ?? 900);
  await send('Emulation.setDeviceMetricsOverride', { width, height: h, deviceScaleFactor: 1, mobile });
  await new Promise((r) => setTimeout(r, 500));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  if (shot?.data) writeFileSync(join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
  const row = { name, path, width, theme, height: h, a11y, errors: [...new Set(errs)].slice(0, 6), failed: [...new Set(failed)].slice(0, 6) };
  report.push(row);
  console.log(`${name.padEnd(46)} h=${String(h).padStart(4)} h1=${a11y.h1} noalt=${a11y.imgsNoAlt}/${a11y.imgs} ovf=${a11y.overflowX} err=${row.errors.length} fail=${row.failed.length}`);
  for (const e of row.errors) console.log('     ' + e);
  for (const f of row.failed) console.log('     ' + f);
}

const projects = await (await fetch(`${BASE}/api/search?q=platform`)).json().catch(() => ({ results: [] }));
const projectHref = projects.results?.find((r) => r.kind === 'project')?.href ?? '/projects';
const posts = await (await fetch(`${BASE}/api/search?q=trigger`)).json().catch(() => ({ results: [] }));
const postHref = posts.results?.find((r) => r.kind === 'post')?.href ?? '/writing';
const ROUTES = ['/', '/about', '/projects', projectHref, '/skills', '/experience', '/profiles', '/resume', '/contact', '/analytics', '/how-it-works', '/writing', postHref, '/definitely-not-a-page'];
const nameOf = (p) => (p === '/' ? 'home' : p.slice(1).replace(/\//g, '_'));

for (const path of ROUTES) {
  await shoot(`${nameOf(path)}.dark`, path, { theme: 'dark' });
  await shoot(`${nameOf(path)}.light`, path, { theme: 'light' });
}
for (const path of ['/', '/projects', projectHref, '/analytics', '/how-it-works', postHref]) {
  await shoot(`m_${nameOf(path)}.dark`, path, { width: 390, mobile: true });
}
await shoot('state_mobile-menu', '/', { width: 390, mobile: true, before: `document.querySelector('nav button[aria-expanded]')?.click()` });
await shoot('state_palette-search', '/', { before: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); setTimeout(() => { ${setReactValue('input[placeholder*="earch"]', 'rate limit')} }, 400);` });
await shoot('state_experience-drawer', '/experience', { before: `document.querySelector('main button')?.click()` });
await shoot('state_projects-filter', '/projects', { before: setReactValue('main input', 'saas') });
await shoot('state_skills-filter', '/skills', { before: `[...document.querySelectorAll('main button')].find(b => /language/i.test(b.textContent))?.click()` });
await shoot('state_contact-validation', '/contact', { before: `document.querySelector('main form button[type="submit"]')?.click()` });

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.errors.length || r.failed.length || r.a11y.h1 !== 1 || r.a11y.overflowX);
console.log(`\n${report.length} captures → ${outDir}; ${bad.length} with findings${bad.length ? ': ' + bad.map((r) => r.name).join(', ') : ''}`);
stop();
process.exit(0);
