import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const RAW = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const PAGE = /[?&]bot\b/.test(RAW) ? RAW : RAW + '?bot';
const PORT = 9781 + Math.floor(Math.random() * 400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader', '--remote-debugging-port=' + PORT, '--window-size=900,700', 'about:blank'],
  { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); ws = new WebSocket((await r.json()).webSocketDebuggerUrl); break; }
  catch (e) { await sleep(250); }
}
if (!ws) { console.log('ERR no devtools'); process.exit(1); }
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
await send('Page.navigate', { url: PAGE }, sid);
for (let i = 0; i < 80; i++) {
  const r = await send('Runtime.evaluate', {
    expression: 'typeof window.__bot === "object" && typeof window.Sim === "object"', returnByValue: true
  }, sid);
  if (r.result && r.result.result && r.result.result.value === true) break;
  await sleep(250);
}
await sleep(400);

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(function(){${expr}})()`, returnByValue: true, awaitPromise: true }, sid);
  const ex = r.result && r.result.exceptionDetails;
  if (ex) return { __err: (ex.text || '') + ' :: ' + ((ex.exception && ex.exception.description) || '') };
  return r.result.result.value;
};

// Play one decade at a time, aiming straight down the middle, and record how
// much game time passes before the third big prop is banked. That is the real
// session length; nothing else in the game gates progress.
const out = await ev(`
  var rows = [];
  for (var st = 0; st < 7; st++) {
    window.__bot.applyStage(st, true);
    var state = window.__bot.state;
    window.UI.state.collected = {};
    window.UI.state.stageIdx = st;
    window.__bot.applyStage(st, true);
    var holder = { time: 0, big: 0, drops: 0, wallet: 0, firstBig: null };
    var bigs = window.CONTENT.STAGES[st].big;
    for (var guard = 0; guard < 400 && holder.big < 3; guard++) {
      window.__bot.advance(20, { dropAt: 0, every: 1.1 });
      holder.time += 20;
      holder.drops = window.Sim.stats.dropped;
      holder.wallet = state.coins;
      holder.big = bigs.filter(function (id) { return !!window.UI.state.collected[id]; }).length;
      if (holder.big >= 1 && holder.firstBig === null) holder.firstBig = holder.time;
      // top up the wallet the way the machine does, or the run dies of poverty
      if (state.coins <= 2) state.coins = 24;
    }
    rows.push({ stage: st, year: window.CONTENT.STAGES[st].year, time: holder.time,
                big: holder.big, drops: holder.drops, firstBig: holder.firstBig,
                stats: JSON.parse(JSON.stringify(window.Sim.stats)) });
  }
  return JSON.stringify(rows);
`);

if (out && out.__err) { console.log('FAIL', out.__err); proc.kill(); process.exit(1); }
const rows = JSON.parse(out);
let total = 0;
for (const r of rows) {
  total += r.time;
  console.log(
    String(r.year).padEnd(5),
    'big ' + r.big + '/3',
    '  cleared@' + String(r.time).padStart(4) + 's',
    '  firstBig@' + String(r.firstBig === null ? '-' : r.firstBig).padStart(4) + 's',
    '  drops ' + String(r.drops).padStart(4),
    '  paid ' + String(r.stats.paid).padStart(4),
    '  lost ' + String(r.stats.lost).padStart(3),
    '  ret ' + (r.stats.dropped ? (r.stats.paid / r.stats.dropped).toFixed(2) : '-')
  );
}
console.log('TOTAL', total + 's', '(' + (total / 60).toFixed(1) + ' min) for all seven');

proc.kill();
process.exit(0);
