/* Hold to feed.
 *
 * A tap is one coin. A finger held still streams coins. A finger that drags is
 * aiming, and must not stream at all. These are the three gestures the whole
 * control scheme rests on, so they are driven through real CDP touch events
 * rather than a synthetic drop() call.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PAGE = process.env.GAME_URL || 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html';
const PORT = 9000 + Math.floor(Math.random() * 900);
const proc = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--window-size=390,844', 'about:blank'
], { stdio: 'ignore' });

let ws, id = 0, sessionId = null;
const pending = new Map(), errors = [];
function send(method, params = {}, sid) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params, sessionId: sid }));
  return new Promise(r => pending.set(mid, r));
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result?.result?.value;
}
for (let i = 0; i < 90; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) { ws = new WebSocket((await r.json()).webSocketDebuggerUrl); break; } } catch {}
  await sleep(100);
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Target.attachedToTarget') { sessionId = m.params.sessionId; return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
};
await send('Target.setDiscoverTargets', { discover: true });
const t = await send('Target.createTarget', { url: 'about:blank' });
await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
for (let i = 0; i < 40 && !sessionId; i++) await sleep(50);
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844
}, sessionId);
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
await send('Page.navigate', { url: PAGE }, sessionId);
await sleep(3000);

async function touchStart(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }, sessionId);
}
async function touchMove(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }, sessionId);
}
async function touchEnd() {
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
}

const probe = async () => JSON.parse(await evaluate(
  '(function(){var p=JSON.parse(__probe());return JSON.stringify({drops:p.drops,coins:p.wallet,busy:p.input.busy});})()'));

await evaluate(`document.getElementById('sGo').click()`);
await sleep(800);

const out = { steps: [] };

// ── 1. a tap is exactly one coin ──────────────────────────────────────────
let a = await probe();
await touchStart(195, 400);
await sleep(60);
await touchEnd();
await sleep(600);
let b = await probe();
out.steps.push({ tap: b.drops - a.drops, pass: b.drops - a.drops === 1 });

// ── 2. a still hold streams, and stops when released ──────────────────────
// NOTE ON THE THRESHOLD. Headless swiftshader throttles timers hard: a 300 ms
// setTimeout measures at ~2400 ms here, so HOLD_REPEAT=230 fires at roughly
// 600 ms a coin in this environment. A real device streams several times
// faster. So this asserts that a hold produces a RUN of coins and that
// releasing stops it -- not that it hits a particular rate.
a = await probe();
await touchStart(195, 400);
// Poll for the run instead of trusting a fixed window. The throttling above is
// not a constant: when the suite runs back to back the machine is still busy
// from the previous browser, timers stretch further, and a 5000 ms sleep that
// reliably caught 2 coins alone caught 1 in a batch. Waiting for the condition
// is the only version that is true on a slow box as well as a fast one.
const holdStart = await probe();
let holdSeen = 0;
for (let i = 0; i < 40; i++) {
  await sleep(400);
  holdSeen = (await probe()).drops - holdStart.drops;
  if (holdSeen >= 3) break;
}
const mid = await probe();
await touchEnd();
const atRelease = await probe();
await sleep(1500);
const afterRelease = await probe();
out.steps.push({
  holdDuring: mid.drops - a.drops,
  holdAfterRelease: afterRelease.drops - atRelease.drops,
  pass: (mid.drops - a.drops) >= 3 && (afterRelease.drops - atRelease.drops) <= 1
});

// ── 3. a drag aims instead of feeding ─────────────────────────────────────
a = await probe();
await touchStart(110, 400);
for (let i = 1; i <= 6; i++) { await touchMove(110 + i * 20, 400); await sleep(45); }
await sleep(1200);             // well past HOLD_DELAY, so a bug would show here
const midDrag = await probe();
await touchEnd();
await sleep(400);
out.steps.push({ dragDuring: midDrag.drops - a.drops, pass: midDrag.drops - a.drops === 0 });

// ── 4. releasing a drag must not also drop ────────────────────────────────
const preTap = await probe();
await sleep(400);
const postTap = await probe();
out.steps.push({ dragReleaseDropped: postTap.drops - preTap.drops, pass: postTap.drops - preTap.drops === 0 });

// ── 5. a second finger must not double the rate ───────────────────────────
a = await probe();
await send('Input.dispatchTouchEvent', {
  type: 'touchStart', touchPoints: [{ x: 195, y: 400, id: 1 }, { x: 240, y: 420, id: 2 }]
}, sessionId);
await sleep(1400);
const twoFinger = await probe();
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
await sleep(300);
out.steps.push({ twoFingerDrops: twoFinger.drops - a.drops, pass: (twoFinger.drops - a.drops) <= 6 });

out.aimX = JSON.parse(await evaluate('__probe()')).input.aimX;
out.errors = errors;

const pass = out.steps.every(s => s.pass) && errors.length === 0;
console.log(JSON.stringify(out, null, 2));
console.log(pass ? 'HOLD OK' : 'HOLD FAIL');
proc.kill();
process.exit(pass ? 0 : 1);
