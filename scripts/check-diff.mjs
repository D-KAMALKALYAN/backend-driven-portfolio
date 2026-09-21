#!/usr/bin/env node
/**
 * Pixel-diff two screenshot folders (from check-screens) and write a diff
 * image per capture, using Chrome's canvas so no image library is needed.
 * Prints the changed fraction and the row bands that changed - open every
 * band; the 2026-09-19 check found an invisible-text bug in a band that had
 * been filed under "icon swaps" without looking (ADR-044 addendum).
 *
 *   npm run check:diff -- <beforeDir> <afterDir> <outDir>
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [before, after, out] = process.argv.slice(2);
if (!before || !after || !out) { console.error('usage: check-diff <before> <after> <out>'); process.exit(2); }
mkdirSync(out, { recursive: true });
const PORT = 9428;
const CHROME = process.env.CHROME_PATH ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!CHROME) { console.error('Chrome not found; set CHROME_PATH'); process.exit(2); }
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), 'check-diff-profile')}`, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch { /* */ } });
let targets = [];
for (let i = 0; i < 50 && !targets.length; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { /* */ } if (!targets.length) await new Promise((r) => setTimeout(r, 300)); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
await send('Runtime.enable');
const ev = (expr) => send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: expr }).then((r) => r?.result?.value ?? r?.exceptionDetails?.text);

for (const f of readdirSync(before).filter((n) => n.endsWith('.png'))) {
  if (!existsSync(join(after, f))) { console.log(`${f}  |  missing in after`); continue; }
  const a = readFileSync(join(before, f)).toString('base64');
  const b = readFileSync(join(after, f)).toString('base64');
  const res = await ev(`(async () => {
    const load = (d) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = 'data:image/png;base64,' + d; });
    const [A, B] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
    const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const px = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(A), db = px(B);
    const dc = document.createElement('canvas'); dc.width = w; dc.height = h; const dx = dc.getContext('2d');
    const img = dx.createImageData(w, h); const o = img.data; let diff = 0; const rows = new Set();
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]);
      if (d > 30) { diff++; o[i] = 255; o[i+1] = 0; o[i+2] = 80; o[i+3] = 255; rows.add(Math.floor(i / 4 / w)); }
      else { const g = (da[i] + da[i+1] + da[i+2]) / 3; o[i] = o[i+1] = o[i+2] = 40 + g * 0.3; o[i+3] = 255; }
    }
    dx.putImageData(img, 0, 0);
    const rs = [...rows].sort((x, y) => x - y); const bands = []; let s = null, prev = null;
    for (const r of rs) { if (s === null) { s = r; prev = r; continue; } if (r - prev > 12) { bands.push([s, prev]); s = r; } prev = r; }
    if (s !== null) bands.push([s, prev]);
    return { pct: (100 * diff / (w * h)).toFixed(2), sizeA: A.width + 'x' + A.height, sizeB: B.width + 'x' + B.height, bands: bands.slice(0, 10), png: dc.toDataURL('image/png').slice(22) };
  })()`);
  if (typeof res !== 'object') { console.log(`${f}  |  error: ${res}`); continue; }
  writeFileSync(join(out, f), Buffer.from(res.png, 'base64'));
  console.log(`${f.padEnd(52)} ${String(res.pct + '%').padStart(7)}  ${res.sizeA} -> ${res.sizeB}  bands: ${res.bands.map(([x, y]) => `${x}-${y}`).join(' ') || 'none'}`);
}
process.exit(0);
