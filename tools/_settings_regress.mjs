// Regression: museum focus trap / detail walk-back / slap meter / collect card,
// plus the settings page on the two smallest phone viewports.
import { spawn } from 'node:child_process';

const arg = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const SHELL = arg('shell',
  'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe');
const URL_ = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function session(W, H) {
  const port = 9500 + Math.floor(Math.random() * 400);
  const child = spawn(SHELL, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let wsUrl = null;
  child.stderr.on('data', b => { const m = /ws:\/\/[^\s]+/.exec(b.toString()); if (m) wsUrl = m[0]; });
  for (let i = 0; i < 120 && !wsUrl; i++) await sleep(100);
  const ws = new WebSocket(wsUrl);
  const waiters = new Map(); const logs = [];
  let sessionId = null;
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') logs.push('PAGEERROR ' +
      (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  });
  await new Promise(r => ws.addEventListener('open', r));
  let nextId = 1;
  const send = (method, params = {}, sid) => new Promise(res => {
    const id = nextId++; waiters.set(id, res);
    ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
  });
  await send('Target.setDiscoverTargets', { discover: true });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  sessionId = att.result.sessionId;
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: true }, sessionId);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate',
      { expression: `(function(){${expr}})()`, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.result?.exceptionDetails) return 'EVALERROR ' + r.result.exceptionDetails.text + ' ' +
      (r.result.exceptionDetails.exception?.description || '');
    return r.result?.result?.value ?? null;
  };
  const evJ = async (expr) => {
    const raw = await ev(expr);
    if (typeof raw === 'string' && raw.startsWith('EVALERROR')) return { EVALERROR: raw };
    try { return JSON.parse(raw); } catch (e) { return { RAW: raw }; }
  };
  await send('Page.navigate', { url: URL_ }, sessionId);
  await sleep(4200);
  await ev(`document.getElementById('sGo').click(); return 1`);
  await sleep(400);
  return { ev, evJ, logs, close: () => { ws.close(); child.kill(); } };
}

async function main() {
  const out = {};

  // ---- museum regressions on the default phone viewport -------------------
  {
    const s = await session(390, 844);
    out.museum = await s.evJ(`
      // seed one collected prop so the grid has a .got tile to open
      var id0 = window.CONTENT.STAGES[0].small[0];
      window.UI.state.collected[id0] = true;
      document.getElementById('museumBtn').click();
      var m = document.getElementById('museum');
      var list = m.querySelectorAll('button,[href],input,select,textarea,[tabindex]');
      var last = list[list.length - 1];
      last.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      var wrapped = m.contains(document.activeElement);
      // open a detail, then Esc walks back to the grid, then Esc closes
      var tile = document.querySelector('#museumGrid .mu.got') || null;
      var openedDetail = false;
      if (tile) { tile.click(); openedDetail = !document.getElementById('museumDetail').hidden; }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      var backToGrid = document.getElementById('museumDetail').hidden;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      window.__mclosed = !m.classList.contains('on');
      return JSON.stringify({
        focusCount: list.length, tabWrapInside: wrapped,
        hasCollectedTile: !!tile, tileName: tile ? tile.textContent.trim().slice(0, 12) : null,
        openedDetail: openedDetail, backToGrid: backToGrid,
        closed: !m.classList.contains('on')
      });
    `);
    await sleep(200);   // focusLater is a 60 ms setTimeout
    out.museumFocus = await s.evJ(`
      return JSON.stringify({ focusAfterClose: document.activeElement && document.activeElement.id,
        hudInert: document.getElementById('hud').hasAttribute('inert') });
    `);
    await s.close();
  }

  // ---- settings on the two smallest phone viewports ----------------------
  for (const [w, h] of [[375, 667], [320, 568]]) {
    const s = await session(w, h);
    const key = `vp${w}x${h}`;
    await s.ev(`document.getElementById('settingsBtn').click(); return 1`);
    await sleep(260);
    out[key] = await s.evJ(`
      var d = document.getElementById('settings');
      var sc = document.getElementById('settingsScroll');
      var ids = ['settingsClose', 'soundToggle', 'settingsReset'];
      var rects = {};
      ids.forEach(function (id) {
        var r = document.getElementById(id).getBoundingClientRect();
        rects[id] = { h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom),
                      inView: r.top >= 0 && r.bottom <= innerHeight + 1 };
      });
      // scroll the reset button into view inside the overlay body and click it there
      document.getElementById('settingsReset').scrollIntoView({ block: 'nearest' });
      var afterScroll = document.getElementById('settingsReset').getBoundingClientRect();
      var rb = document.getElementById('settingsReset');
      rb.click();
      var armed = rb.classList.contains('armed');
      rb.click();
      var p = JSON.parse(window.__probe());
      return JSON.stringify({
        vw: innerWidth, vh: innerHeight,
        pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
        overflowsX: document.documentElement.scrollWidth > innerWidth + 1,
        bodyScrolls: sc.scrollHeight > sc.clientHeight + 1,
        bodyClientH: sc.clientHeight, bodyScrollH: sc.scrollHeight,
        rects: rects, minBtnH: Math.min(rects.settingsClose.h, rects.soundToggle.h, rects.settingsReset.h),
        resetReachable: afterScroll.bottom <= innerHeight + 1,
        armedThenConfirmed: armed && p.stage === 0 && p.collected === 0 && p.wallet === 0,
        coins: document.getElementById('coins').textContent,
        save: JSON.parse(localStorage.getItem('yatmangai.save.v1'))
      });
    `);
    await s.close();
  }

  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
main().catch(e => { console.error('HARNESS FAIL', e.message, e.stack); process.exit(1); });
