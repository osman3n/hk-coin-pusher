/* Is the bottom of the screen still a game, or is it a toolbar?
 *
 * The brief was "keep the UI clean, this is a touch monitor". So: exactly two
 * controls, one of them the action; settings reachable but not in the way; and
 * nothing on the table that you cannot press with a thumb.
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

const VIEWS = [
  { name: 'phone-portrait', w: 390, h: 844, dsf: 3 },
  { name: 'phone-small', w: 320, h: 568, dsf: 2 },
  { name: 'phone-landscape', w: 844, h: 390, dsf: 3 }
];

const out = { views: [], steps: [] };
let shotDone = false;

for (const v of VIEWS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: v.w, height: v.h, deviceScaleFactor: v.dsf, mobile: true, screenWidth: v.w, screenHeight: v.h
  }, sessionId);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
  await send('Page.navigate', { url: PAGE }, sessionId);
  await sleep(3200);
  await evaluate(`document.getElementById('sGo').click()`);
  await sleep(900);

  const m = JSON.parse(await evaluate(`(function(){
    var row = document.querySelector('.btnRow');
    var btns = [].map.call(row.querySelectorAll('button'), function(b){
      var r = b.getBoundingClientRect();
      return { id: b.id, w: Math.round(r.width), h: Math.round(r.height),
               label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0,10) };
    });
    var all = [].map.call(document.querySelectorAll('#hud button, #hud [role=button]'), function(b){
      return b.id || b.className;
    });
    return JSON.stringify({
      row: btns,
      hudControls: all,
      hasSettingsBtn: !!document.getElementById('settingsBtn'),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight
    });
  })()`));

  out.views.push({ view: v.name, size: v.w + 'x' + v.h, ...m });

  if (v.name === 'phone-portrait' && !shotDone) {
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync('shots/ui', { recursive: true });
    writeFileSync('shots/ui/bottom-bar.png', Buffer.from(shot.result.data, 'base64'));
    shotDone = true;
  }
}

// ── settings reachable from the cabinet, and it comes back ────────────────
await evaluate(`document.getElementById('museumBtn').click()`);
await sleep(700);
const museumOpen = await evaluate(`document.getElementById('museum').classList.contains('on')`);
const hasLink = await evaluate(`!!document.getElementById('museumSettings')`);

await evaluate(`document.getElementById('museumSettings').click()`);
await sleep(700);
const settingsOpen = await evaluate(`document.getElementById('settings').classList.contains('on')`);
const museumStill = await evaluate(`document.getElementById('museum').classList.contains('on')`);

// closing settings must put the museum back, not unlock the frozen page.
// ui.js hands focus back on a 60 ms timer, which headless swiftshader
// throttles to roughly half a second, so poll instead of guessing.
await evaluate(`document.getElementById('settingsClose').click()`);
for (let i = 0; i < 30; i++) {
  const f = await evaluate(`document.activeElement ? document.activeElement.id : ''`);
  if (f === 'museumClose' || f === 'museumSettings') break;
  await sleep(100);
}
const afterClose = await evaluate(`(function(){
  return JSON.stringify({
    settings: document.getElementById('settings').classList.contains('on'),
    museum: document.getElementById('museum').classList.contains('on'),
    hudInert: document.getElementById('hud').hasAttribute('inert'),
    focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null
  });
})()`);

// and closing the museum hands the table back
await evaluate(`document.getElementById('museumClose').click()`);
await sleep(900);
const afterMuseum = await evaluate(`(function(){
  return JSON.stringify({
    museum: document.getElementById('museum').classList.contains('on'),
    hudInert: document.getElementById('hud').hasAttribute('inert')
  });
})()`);

const back = JSON.parse(afterClose);
const museumBack = JSON.parse(afterMuseum);

out.steps.push({ name: 'museum opens', pass: museumOpen === true });
out.steps.push({ name: 'settings link in museum', pass: hasLink === true && settingsOpen === true });
out.steps.push({ name: 'settings replaces the museum, not stacks on it', pass: museumStill === false });
out.steps.push({
  name: 'closing settings lands back in the museum',
  pass: back.settings === false && back.museum === true && back.hudInert === true &&
        (back.focus === 'museumClose' || back.focus === 'museumSettings')
});
out.steps.push({
  name: 'closing museum unfreezes the table',
  pass: museumBack.museum === false && museumBack.hudInert === false
});

out.back = back;
out.museumBack = museumBack;
out.errors = errors;

const twoControls = out.views.every(v => v.row.length === 2 && !v.hasSettingsBtn);
const noOverflow = out.views.every(v => v.overflowX <= 0 && v.overflowY <= 0);
const bigEnough = out.views.every(v => v.row.every(b => b.h >= 40 && b.w >= 44));
out.steps.push({ name: 'two controls, no settings on the table', pass: twoControls });
out.steps.push({ name: 'no scroll on any phone view', pass: noOverflow });
out.steps.push({ name: 'every control at least 44x40', pass: bigEnough });

const pass = out.steps.every(s => s.pass) && errors.length === 0;
console.log(JSON.stringify(out, null, 2));
console.log(pass ? 'UI OK' : 'UI FAIL');
proc.kill();
process.exit(pass ? 0 : 1);
