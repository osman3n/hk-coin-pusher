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
// The game refuses drops before the start card is dismissed; click it the way
// a player does instead of forcing state.
await send('Runtime.evaluate', { expression: `document.getElementById('sGo').click()`, returnByValue: true }, sid);
await sleep(900);

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(function(){${expr}})()`, returnByValue: true, awaitPromise: true }, sid);
  const ex = r.result && r.result.exceptionDetails;
  if (ex) return { __err: (ex.text || '') + ' :: ' + ((ex.exception && ex.exception.description) || '') };
  return r.result.result.value;
};

// Calibrate: how much wall time does 10 s of simulated play cost?
const c0 = Date.now();
const cal = await ev(`window.__bot.applyStage(0, true); window.__bot.advance(10, { dropAt: 0, every: 1.1 }); return JSON.stringify(window.Sim.stats);`);
console.log('advance(10) took', Date.now() - c0, 'ms wall ->', cal);

// Then play one decade in 15 s slices, reporting as we go, so a slow run still
// produces evidence instead of timing out silently.
const target = parseInt(process.argv[2] || '0', 10);
const cap = parseInt(process.argv[3] || '600', 10);
await ev(`
  window.__pac = { time: 0, big: 0 };
  window.UI.state.collected = {};
  window.UI.state.stageIdx = ${target};
  window.__bot.applyStage(${target}, true);
  return 1;
`);
const bigs = await ev(`return JSON.stringify(window.CONTENT.STAGES[${target}].big);`);
console.log('stage', target, 'bigs', bigs);

let elapsed = 0;
while (elapsed < cap) {
  const r = await ev(`
    // A prize card stops the world until it is dismissed, exactly as on a real
    // cabinet. A measuring bot that never clicks measures a frozen game.
    var cards = 0;
    while (window.UI.isCardOpen && window.UI.isCardOpen()) { window.UI.closeCard(); cards++; if (cards > 40) break; }
    window.__bot.advance(15, { dropAt: 0, every: 1.1 });
    window.__pac.time += 15;
    while (window.UI.isCardOpen && window.UI.isCardOpen()) { window.UI.closeCard(); cards++; if (cards > 40) break; }
    var st = window.__bot.state;
    if (st.coins <= 2) st.coins = 24;
    var bigs = window.CONTENT.STAGES[${target}].big;
    window.__pac.big = bigs.filter(function (id) { return !!window.UI.state.collected[id]; }).length;
    window.__pac.stats = window.Sim.stats;
    return JSON.stringify({ t: window.__pac.time, big: window.__pac.big, got: Object.keys(window.UI.state.collected),
      paid: window.Sim.stats.paid, dropped: window.Sim.stats.dropped, lost: window.Sim.stats.lost,
      bigPaid: window.Sim.stats.bigPaid, props: window.Sim.countProps() });
  `);
  if (r && r.__err) { console.log('FAIL', r.__err); break; }
  const o = JSON.parse(r);
  elapsed = o.t;
  console.log('t=' + o.t, 'big=' + o.big + '/3', 'props=' + o.props, 'bigPaid=' + o.bigPaid,
    'paid=' + o.paid, 'dropped=' + o.dropped, 'lost=' + o.lost, 'got=[' + o.got.join(',') + ']');
  if (o.big >= 3) { console.log('CLEARED at', o.t, 's'); break; }
}

proc.kill();
process.exit(0);
