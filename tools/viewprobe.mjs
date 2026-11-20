/* Does the machine actually fit on a phone?
 *
 * A screenshot only proves the pixels that happened to be in frame. This
 * projects known table corners through the live camera and reports how much of
 * the NDC box [-1,1] the machine occupies, per viewport. If a corner is outside
 * the box, the player physically cannot see the thing it belongs to.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
// Local by default; set GAME_URL= to test the deployed build on purpose.
const PAGE = process.env.GAME_URL || 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html';

const VIEWPORTS = [
  { name: 'phone-portrait',   w: 390,  h: 844,  dpr: 3, mobile: true },
  { name: 'phone-small',      w: 320,  h: 568,  dpr: 2, mobile: true },
  { name: 'phone-landscape',  w: 844,  h: 390,  dpr: 3, mobile: true },
  { name: 'tablet-portrait',  w: 820,  h: 1180, dpr: 2, mobile: true },
  { name: 'desktop',          w: 1280, h: 800,  dpr: 1, mobile: false }
];

const shotHit = process.argv.slice(2).find(a => a.startsWith('--shot='));
const shotDir = shotHit ? shotHit.split('=')[1] : null;

const PORT = 9000 + Math.floor(Math.random() * 900);
const proc = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,900', 'about:blank'
], { stdio: 'ignore' });

let ws, id = 0, sessionId = null;
const pending = new Map(), errors = [];

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

for (let i = 0; i < 90; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) {
      ws = new WebSocket((await r.json()).webSocketDebuggerUrl);
      break;
    }
  } catch {}
  await sleep(100);
}
if (!ws) { console.error('no devtools'); process.exit(1); }
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Target.attachedToTarget') { sessionId = m.params.sessionId; return; }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push('PAGEERROR ' + (m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
  }
};

await send('Target.setDiscoverTargets', { discover: true });
const t = await send('Target.createTarget', { url: 'about:blank' });
await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
for (let i = 0; i < 40 && !sessionId; i++) await sleep(50);
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);

// Project the machine's extremes through the live camera. Anything outside
// [-1,1] is off-screen; the safe band is tighter than that because the HUD
// owns the top and bottom of the picture.
const PROBE = `(function () {
  var THREE = window.THREE, R = window.R, Sim = window.Sim;
  if (!THREE || !R || !R.camera) return JSON.stringify({ err: 'not ready' });
  var cam = R.camera;
  var pts = {
    tableBackL:[-0.56,0,-0.44], tableBackR:[0.56,0,-0.44],
    tableFrontL:[-0.56,0,0.30], tableFrontR:[0.56,0,0.30],
    trayLip:[0,-0.09,0.62],
    chute:[0,0.12,-0.34],
    cabLeft:[-0.62,0.08,0.10], cabRight:[0.62,0.08,0.10]
  };
  var out = {}, worstX = 0, worstY = 0, off = [];
  Object.keys(pts).forEach(function (k) {
    var v = new THREE.Vector3(pts[k][0], pts[k][1], pts[k][2]).project(cam);
    out[k] = [+v.x.toFixed(3), +v.y.toFixed(3)];
    if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) off.push(k);
    worstX = Math.max(worstX, Math.abs(v.x));
    worstY = Math.max(worstY, Math.abs(v.y));
  });
  return JSON.stringify({
    ndc: out, offscreen: off,
    worstX: +worstX.toFixed(3), worstY: +worstY.toFixed(3),
    dist: +R.framing.dist.toFixed(3), pitch: +R.framing.pitch.toFixed(3),
    aspect: +R.framing.aspect.toFixed(3), portrait: R.framing.portrait,
    dpr: +R.pixelRatio().toFixed(2),
    camPos: cam.position.toArray().map(function(v){return +v.toFixed(3);}),
    camAspect: +cam.aspect.toFixed(4), camFov: cam.fov,
    proj: [cam.projectionMatrix.elements[0], cam.projectionMatrix.elements[5]].map(function(v){return +v.toFixed(4);}),
    inner: [innerWidth, innerHeight],
    canvas: [R.pixelRatio ? document.getElementById('c').width : 0,
             document.getElementById('c').height],
    scrollable: [document.documentElement.scrollWidth > innerWidth,
                 document.documentElement.scrollHeight > innerHeight],
    hudOverflow: (function () {
      var bad = [];
      ['coins','year','stageName','bigRow','hint'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) bad.push(id);
      });
      return bad;
    })(),
    touchTargets: (function () {
      var small = [];
      document.querySelectorAll('button').forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (r.width > 0 && (r.height < 40 || r.width < 40)) small.push(b.id + ':' + Math.round(r.height));
      });
      return small;
    })()
  });
})()`;

const results = [];
for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: vp.mobile,
    screenWidth: vp.w, screenHeight: vp.h
  }, sessionId);
  if (vp.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
  await send('Page.navigate', { url: PAGE }, sessionId);
  await sleep(2600);
  await evaluate(`document.getElementById('sGo')?.click()`);
  await sleep(1400);
  const raw = await evaluate(PROBE);
  const r = JSON.parse(raw);
  r.viewport = vp.name;
  r.size = vp.w + 'x' + vp.h + '@' + vp.dpr;
  results.push(r);
  if (shotDir) {
    const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    if (cap.result?.data) writeFileSync(`${shotDir}/${vp.name}.png`, Buffer.from(cap.result.data, 'base64'));
  }
}

console.log(JSON.stringify({ views: results, errors }, null, 1));

let bad = 0;
for (const r of results) {
  if (r.err) { console.log('ERR ' + r.viewport + ' ' + r.err); bad++; continue; }
  const flags = [];
  if (r.offscreen.length) flags.push('OFFSCREEN ' + r.offscreen.join(','));
  if (r.worstY > 0.95) flags.push('fills-height');
  if (r.scrollable[0] || r.scrollable[1]) flags.push('SCROLLS');
  if (r.hudOverflow.length) flags.push('HUD-CLIP ' + r.hudOverflow.join(','));
  if (r.touchTargets.length) flags.push('SMALL-BTN ' + r.touchTargets.join(','));
  if (flags.length) bad++;
  console.log((flags.length ? 'WARN ' : 'OK   ') + r.viewport.padEnd(16) + r.size.padEnd(14) +
    'dist=' + r.dist + ' pitch=' + r.pitch + ' dpr=' + r.dpr +
    ' worstX=' + r.worstX + ' worstY=' + r.worstY +
    (flags.length ? '  <-- ' + flags.join(' ') : ''));
}
try { ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); } catch {}
proc.kill();
process.exit(bad ? 1 : 0);
