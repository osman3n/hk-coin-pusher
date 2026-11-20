/* Does a finger actually play this?
 *
 * Emulated DOM events are not enough: the game listens on pointerType, and a
 * synthetic click never proves the gesture path. This drives real CDP touch
 * events, so a tap, a drag-then-tap and a two-finger fumble all go through the
 * same handlers a phone would hit.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
// Local by default; set GAME_URL= to test the deployed build on purpose.
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
await sleep(2800);

async function tap(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }, sessionId);
  await sleep(55);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
  await sleep(120);
}
async function drag(x0, y0, x1, y1, steps = 8) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] }, sessionId);
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }]
    }, sessionId);
    await sleep(18);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
  await sleep(220);
}

const out = { steps: [], errors };
function note(k, v) { out.steps.push({ [k]: v }); }

// 1. tap the start button -- a real touch, not a click
const go = JSON.parse(await evaluate(`JSON.stringify((function(){
  var r=document.getElementById('sGo').getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2,h:Math.round(r.height)};
})())`));
note('startButton', go.h);
await tap(go.x, go.y);
await sleep(900);
const started = await evaluate(`JSON.parse(window.__probe()).started`);
note('startedAfterTap', started);

// 2. a tap on the table should drop exactly one coin
const d0 = JSON.parse(await evaluate(`JSON.parse(window.__probe()).drops`));
await tap(195, 470);
await sleep(400);
const d1 = JSON.parse(await evaluate(`JSON.parse(window.__probe()).drops`));
note('tapDropped', { before: d0, after: d1, delta: d1 - d0 });

// 3. a drag must aim, NOT drop
const w0 = JSON.parse(await evaluate(`JSON.parse(window.__probe()).drops`));
await drag(160, 470, 250, 470);
await sleep(400);
note('inputAfterDrag', JSON.parse(await evaluate(`JSON.stringify(JSON.parse(window.__probe()).input)`)));
const w1 = JSON.parse(await evaluate(`JSON.parse(window.__probe()).drops`));
note('dragDidNotDrop', { before: w0, after: w1, delta: w1 - w0 });

// 4. after the drag, a tap commits at the new aim
const w2 = w1;
await tap(250, 470);
await sleep(400);
note('inputAfterTap', JSON.parse(await evaluate(`JSON.stringify(JSON.parse(window.__probe()).input)`)));
const w3 = JSON.parse(await evaluate(`JSON.parse(window.__probe()).drops`));
note('tapAfterDragDropped', { before: w2, after: w3, delta: w3 - w2 });

// 5. two fingers at once must not double-drop
const w4 = JSON.parse(await evaluate(`JSON.parse(window.__probe()).drops`));
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 470, id: 1 }] }, sessionId);
await sleep(40);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 470, id: 1 }, { x: 240, y: 470, id: 2 }] }, sessionId);
await sleep(60);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
await sleep(400);
const w5 = JSON.parse(await evaluate(`JSON.parse(window.__probe()).drops`));
note('twoFingerDropCount', { delta: w5 - w4 });

// 6. the page must not scroll or rubber-band
const scroll = JSON.parse(await evaluate(`JSON.stringify({
  x: scrollX, y: scrollY,
  sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
  iw: innerWidth, ih: innerHeight
})`));
note('scroll', scroll);

// 7. landscape rotation: resize without reload and the camera must refit
await send('Emulation.setDeviceMetricsOverride', {
  width: 844, height: 390, deviceScaleFactor: 3, mobile: true, screenWidth: 844, screenHeight: 390
}, sessionId);
/* The relayout is debounced (resize 0 ms, visualViewport 120 ms,
   orientationchange 220 ms) and the first resize can land before the emulation
   override settles. A fixed sleep raced it; poll until the aspect actually
   changes, then give it one more frame to finish the projection. */
async function waitAspect(want, ceilingMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < ceilingMs) {
    const a = Number(await evaluate('+window.R.camera.aspect.toFixed(3)'));
    if (Math.abs(a - want) < 0.02) { await sleep(120); return true; }
    await sleep(80);
  }
  return false;
}
await waitAspect(844 / 390, 4000);
const land = JSON.parse(await evaluate(`JSON.stringify((function(){
  var R=window.R, THREE=window.THREE, cam=R.camera;
  var worst=0;
  [[-0.60,0,-0.44],[0.60,0,-0.44],[-0.60,0,0.30],[0.60,0,0.30],[0,-0.09,0.62],[0,0.12,-0.34]].forEach(function(p){
    var v=new THREE.Vector3(p[0],p[1],p[2]).project(cam);
    worst=Math.max(worst, Math.abs(v.x));
  });
  return { aspect:+cam.aspect.toFixed(3), dist:+R.framing.dist.toFixed(3), portrait:R.framing.portrait, worstX:+worst.toFixed(3) };
})())`));
note('landscapeRefit', land);

// 8. back to portrait
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844
}, sessionId);
await waitAspect(390 / 844, 4000);
const port = JSON.parse(await evaluate(`JSON.stringify({aspect:+window.R.camera.aspect.toFixed(3),portrait:window.R.framing.portrait})`));
note('portraitRefit', port);

console.log(JSON.stringify(out, null, 1));

const fails = [];
/* Look steps up by key. Index-based assertions silently drift whenever a probe
   is inserted earlier in the run -- which is exactly what happened. */
const stepAt = k => (out.steps.find(s => k in s) || {})[k];
const chkStart = stepAt('startedAfterTap');
if (chkStart !== true) fails.push('tap did not start game');
const chkTap1 = stepAt('tapDropped');
if (!chkTap1 || chkTap1.delta !== 1) fails.push('tap did not drop exactly 1 coin: ' + (chkTap1 && chkTap1.delta));
const chkDrag = stepAt('dragDidNotDrop');
if (!chkDrag || chkDrag.delta !== 0) fails.push('drag dropped a coin: ' + (chkDrag && chkDrag.delta));
const chkTap2 = stepAt('tapAfterDragDropped');
if (!chkTap2 || chkTap2.delta !== 1) fails.push('tap-after-drag did not drop 1: ' + (chkTap2 && chkTap2.delta));
const chkTwo = stepAt('twoFingerDropCount');
if (!chkTwo || chkTwo.delta > 1) fails.push('two fingers dropped ' + (chkTwo && chkTwo.delta) + ' coins');
const chkScroll = stepAt('scroll');
if (!chkScroll) fails.push('scroll probe missing');
else if (chkScroll.sw > chkScroll.iw || chkScroll.sh > chkScroll.ih) fails.push('page scrolls');
const chkLand = stepAt('landscapeRefit');
if (!chkLand) fails.push('landscape refit missing');
else {
  if (chkLand.worstX > 1) fails.push('landscape crops the table');
  if (chkLand.portrait !== false) fails.push('landscape still framed as portrait');
}
const chkPort = stepAt('portraitRefit');
if (!chkPort || chkPort.portrait !== true) fails.push('portrait refit did not happen');
if (errors.length) fails.push('page errors: ' + errors.slice(0, 3).join(' | '));

console.log(fails.length ? 'FAIL\n - ' + fails.join('\n - ') : 'TOUCH OK');
try { ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); } catch {}
proc.kill();
process.exit(fails.length ? 1 : 0);
