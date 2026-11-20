/* Trace props in the LIVE page: where they sit and whether they move.
 * The node-side tuner says a small prop falls in ~35 s; in the real game none
 * fell in 95 s. Find out which of those two worlds is lying.
 *
 * Mirrors tools/cdp.mjs: connect on the browser-level socket and attach to the
 * page target explicitly. Opening a tab and reading /json/list is a different
 * (and here, empty) path.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PORT = 9000 + Math.floor(Math.random() * 800);
const url = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html';

const proc = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,800', 'about:blank',
], { stdio: 'ignore' });

let ws, id = 0, sessionId = null;
const pending = new Map();
const logs = [];

async function connect() {
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; }
    } catch { /* not up yet */ }
    await sleep(100);
  }
  if (!wsUrl) throw new Error('devtools never came up');
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Target.attachedToTarget') { sessionId = m.params.sessionId; return; }
    if (m.method === 'Runtime.exceptionThrown') logs.push('PAGEERROR ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('CONSOLE-ERR');
  };
  await send('Target.setDiscoverTargets', { discover: true });
  const t = await send('Target.createTarget', { url: 'about:blank' });
  await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
  for (let i = 0; i < 40 && !sessionId; i++) await sleep(50);
  if (!sessionId) throw new Error('attach failed');
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
}

function send(method, params = {}, sid) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params, sessionId: sid }));
  return new Promise(res => pending.set(mid, res));
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result?.result?.value;
}

try {
  await connect();
  await send('Page.navigate', { url }, sessionId);
  await sleep(4000);
  await evaluate(`document.getElementById('sGo')?.click()`);
  await sleep(400);

  await evaluate(`
    window.__dropTimer = setInterval(function () {
      var c = document.getElementById('c');
      var x = 480 + Math.random() * 320;
      c.dispatchEvent(new PointerEvent('pointerdown', {clientX:x, clientY:300, bubbles:true, pointerId:1}));
      c.dispatchEvent(new PointerEvent('pointerup', {clientX:x, clientY:300, bubbles:true, pointerId:1}));
    }, 700);
  `);

  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const snap = await evaluate(`(function(){
      var s = window.Sim, out = {t: +s.t.toFixed(1), plate: +s.plateFront.toFixed(3), props: []};
      for (var i = 0; i < s.coins.length; i++) {
        var c = s.coins[i];
        if (c.kind === 'prop') out.props.push({id:c.prop, x:+c.x.toFixed(3), z:+c.z.toFixed(3), l:c.l, vz:+c.vz.toFixed(4)});
      }
      out.coins = s.coins.length;
      out.stats = s.stats;
      out.wallet = JSON.parse(window.__probe()).wallet;
      return JSON.stringify(out);
    })()`);
    console.log(snap);
  }
  await evaluate(`clearInterval(window.__dropTimer)`);
} catch (e) {
  console.log('ERR', String(e));
  console.log(logs.slice(-6).join('\n'));
} finally {
  try { ws?.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); } catch {}
  proc.kill();
  process.exit(0);
}
