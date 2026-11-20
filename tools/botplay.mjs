/* Bot play-through: drive the real page until a prop is collected, so the
 * collection card, the save and the stage-done path all run for real.
 *
 * This is the only way to prove the loop closes. A screenshot of a pusher
 * table looks identical whether or not the game behind it works.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PORT = 9000 + Math.floor(Math.random() * 800);
const url = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';

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
    } catch {}
    await sleep(100);
  }
  if (!wsUrl) throw new Error('devtools never came up');
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Target.attachedToTarget') { sessionId = m.params.sessionId; return; }
    if (m.method === 'Runtime.exceptionThrown') logs.push('PAGEERROR ' + (m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('CONSOLE ' + m.params.args.map(a => a.value).join(' '));
  };
  await send('Target.setDiscoverTargets', { discover: true });
  const t = await send('Target.createTarget', { url: 'about:blank' });
  await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
  for (let i = 0; i < 40 && !sessionId; i++) await sleep(50);
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

// --secs=N or a bare number. A bad flag used to parse to NaN, which made the
// main loop exit instantly and print an empty-but-green result.
function argNum(name, dflt) {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  const raw = hit ? hit.split('=')[1] : process.argv.slice(2).find(a => /^\d+$/.test(a));
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}
const seconds = argNum('secs', 120);
const shotHit = process.argv.slice(2).find(a => a.startsWith('--shot='));
const shotPath = shotHit ? shotHit.split('=')[1] : null;
if (!Number.isFinite(seconds) || seconds <= 0) {
  console.error('botplay: bad --secs');
  process.exit(2);
}
const result = { frames: [], events: [], errors: logs };

try {
  await connect();
  await send('Page.navigate', { url }, sessionId);
  // The start click used to fire before UI.init() bound the handler, so the
  // whole run silently played the title screen and reported an empty pass.
  let started = false;
  for (let i = 0; i < 15; i++) {
    await sleep(700);
    await evaluate(`document.getElementById('sGo')?.click()`);
    await sleep(250);
    started = await evaluate(`!!(window.__bot && window.__bot.state && window.__bot.state.started)`);
    if (started) break;
  }
  if (!started) throw new Error('botplay: game never started');
  console.log('STARTED');

  // a bot that aims at the slot, drops, and records what happens
  await evaluate(`
    window.__log = [];
    window.__botTimer = setInterval(function () {
      if (!window.__bot) return;
      var st = window.__bot.state;
      if (st.coins <= 0) return;
      // aim at the middle of the slot, with human-sized error
      var aimX = (Math.random() - 0.5) * 0.18;
      window.__bot.dropAt(aimX);
    }, 850);
  `);

  const t0 = Date.now();
  let lastCollected = 0;
  while (Date.now() - t0 < seconds * 1000) {
    await sleep(6000);
    const snap = await evaluate(`(function(){
      var p = JSON.parse(window.__probe());
      return JSON.stringify({
        t: +(performance.now()/1000).toFixed(0),
        wallet: p.wallet, paid: p.stats.paid, lost: p.stats.lost,
        fall: p.fall, fallY: p.fallY, trayY: p.trayY,
        props: p.props, collected: p.collected,
        dbg: window.R && window.R.debugFall ? window.R.debugFall() : null,
        card: document.getElementById('card')?.classList.contains('on'),
        cardName: document.getElementById('cardName')?.textContent || '',
        done: document.getElementById('done')?.classList.contains('on')
      });
    })()`);
    const s = JSON.parse(snap);
    result.frames.push(s);
    console.log(snap);
    if (s.collected > lastCollected) {
      result.events.push({ at: s.t, collected: s.collected, card: s.cardName });
      lastCollected = s.collected;
      // close the card like a player would
      await evaluate(`document.getElementById('cardClose')?.click()`);
    }
    if (shotPath && !result.shot && s.t >= 40) {
      result.shot = true;
      const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      if (cap.result?.data) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(shotPath, Buffer.from(cap.result.data, 'base64'));
        console.log('SHOT', shotPath);
      }
    }
    if (s.done) { result.events.push({ at: s.t, stageDone: true }); break; }
  }
} catch (e) {
  console.log('ERR', String(e));
} finally {
  console.log('EVENTS', JSON.stringify(result.events));
  console.log('ERRORS', JSON.stringify(logs.slice(0, 5)));
  try { ws?.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); } catch {}
  proc.kill();
  process.exit(0);
}
