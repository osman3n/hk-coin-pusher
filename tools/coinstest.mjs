import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PAGE = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20') + '?bot';
const PORT = 9781 + Math.floor(Math.random() * 400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, label, extra) => {
  if (!cond) fails++;
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra === undefined ? '' : ' \u2014 ' + JSON.stringify(extra)));
};

const proc = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1280,800', 'about:blank'],
  { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); ws = new WebSocket((await r.json()).webSocketDebuggerUrl); break; }
  catch (e) { await sleep(250); }
}
if (!ws) { console.log('ERR no devtools endpoint'); process.exit(1); }
await new Promise((r) => { ws.onopen = r; });
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});

const t = (await send('Target.createTarget', { url: 'about:blank' })).result.targetId;
const sid = (await send('Target.attachToTarget', { targetId: t, flatten: true })).result.sessionId;
await send('Runtime.enable', {}, sid);
await send('Page.enable', {}, sid);
const errs = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.params && d.params.method === 'Runtime.exceptionThrown') errs.push(d.params.params.exceptionDetails.text);
});
await send('Page.navigate', { url: PAGE }, sid);
// Poll for the seam rather than guessing a delay: headless swiftshader starts
// the renderer late and a fixed 3.6 s wait intermittently raced it, which the
// first version of this test silently swallowed as a pass.
{
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const r = await send('Runtime.evaluate', {
      expression: 'typeof window.__bot === "object" && typeof window.R === "object"',
      returnByValue: true
    }, sid);
    if (r.result && r.result.result && r.result.result.value === true) { ready = true; break; }
    await sleep(250);
  }
  if (!ready) { console.log('COINSTYLE FAIL \u2014 page never exposed __bot'); proc.kill(); process.exit(1); }
}
await sleep(400);
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(function(){${expr}})()`, returnByValue: true, awaitPromise: true }, sid);
  const ex = r.result && r.result.exceptionDetails;
  if (ex) {
    const d = ex.exception && (ex.exception.description || ex.exception.value);
    return { __err: (ex.text || '') + ' :: ' + (d || '') };
  }
  return r.result.result.value;
};
await ev(`document.getElementById('sGo').click(); return 1`);
await sleep(900);

// Walk every decade and record the coin face each one renders with.
const raw = await ev(`
  var rows = [];
  for (var i = 0; i < 7; i++) {
    window.__bot.applyStage(i, true);
    // applyStage seeds the pile but the renderer only syncs on the next frame,
    // and headless swiftshader renders at ~4 fps. Sync it here so the mesh
    // count is a real measurement rather than a race.
    window.R.sync(window.Sim, 0);
    var cs = window.R.coinStyle();
    var n = 0;
    window.R.scene.traverse(function (o) { if (o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry') n++; });
    rows.push({ stage: i, idx: cs.index, body: cs.name,
                cylMeshes: n,
                year: document.getElementById('year').textContent });
  }
  return JSON.stringify(rows);
`);
const out = typeof raw === 'string' ? JSON.parse(raw) : raw;
console.log(JSON.stringify(out, null, 1));
if (out && out.__err) { console.log('COINSTYLE FAIL — probe threw'); proc.kill(); process.exit(1); }

if (Array.isArray(out)) {
  const idx = out.map((r) => r.idx);
  ok(idx[0] === 0 && idx[1] === 0, '1972 and 1980 share the first coin', idx);
  ok(idx[2] === 1 && idx[3] === 1, '1997 and 2003 share the second coin', idx);
  ok(idx[4] === 2 && idx[5] === 2, '2010 and 2020 share the third coin', idx);
  ok(idx[6] === 3, '2026 has its own coin', idx);
  ok(new Set(out.slice(0, 7).map((r) => r.body)).size === 4, 'four distinct coin bodies', out.slice(0, 7).map((r) => r.body));
  ok(out.every((r) => r.cylMeshes > 0), 'coins still render on every decade', out.map((r) => r.cylMeshes));
}
ok(errs.length === 0, 'no console exceptions', errs);
ok(Array.isArray(out), 'the decade walk returned rows', out && out.__err);

console.log(fails ? 'COINSTYLE FAIL' : 'COINSTYLE OK');
proc.kill();
process.exit(fails ? 1 : 0);
