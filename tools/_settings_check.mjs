// Verification harness for the settings page: reset progress + phone layout.
// Usage: node tools/_settings_check.mjs [--w=390] [--h=844] [--shot=out.png]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const W = +arg('w', 390);
const H = +arg('h', 844);
const shotPath = arg('shot', '');
const SHELL = arg('shell',
  'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe');
const URL_ = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 400);

const child = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let wsUrl = null;
child.stderr.on('data', b => {
  const m = /ws:\/\/[^\s]+/.exec(b.toString());
  if (m) wsUrl = m[0];
});

async function main() {
  for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
  if (!wsUrl) throw new Error('no devtools ws');

  const ws = new WebSocket(wsUrl);
  const waiters = new Map();
  const logs = [];
  let sessionId = null;
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push('PAGEERROR ' + (d.exception?.description || d.text));
    }
    if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      if (e.level === 'error') logs.push(`LOG[${e.level}] ${e.text}`);
    }
  });
  await new Promise(r => ws.addEventListener('open', r));
  let nextId = 1;
  const send = (method, params = {}, sid) => new Promise(res => {
    const id = nextId++;
    waiters.set(id, res);
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
    if (r.result?.exceptionDetails) {
      return 'EVALERROR ' + r.result.exceptionDetails.text + ' ' +
        (r.result.exceptionDetails.exception?.description || '');
    }
    const res = r.result?.result;
    return res?.value ?? res?.description ?? null;
  };
  const evJ = async (expr) => {
    const raw = await ev(expr);
    if (typeof raw === 'string' && raw.startsWith('EVALERROR')) return { EVALERROR: raw };
    try { return JSON.parse(raw); } catch (e) { return { RAW: raw }; }
  };

  await send('Page.navigate', { url: URL_ }, sessionId);
  await sleep(4200);

  const out = {};

  // ---- 1. seed a run that is NOT the beginning ------------------------------
  out.seed = await evJ(`
    var P = function () { return JSON.parse(window.__probe()); };
    var b = window.__bot;
    if (!b) return JSON.stringify({ err: 'NO BOT' });
    var S = window.UI.state;
    S.collected = { sodaCase: 1, lapSapChung: 1, dingDing: 1 };
    S.found = ['sodaCase', 'lapSapChung', 'dingDing'];
    S.storySeen = { '0_1': 1, '0_2': 1, '1_1': 1 };
    b.applyStage(3, true);
    S.stageIdx = 3;
    S.coins = 63;
    window.UI.setCoins(63);
    window.UI.setBigCount(window.CONTENT.STAGES[3]);
    window.UI.save();
    var p = P();
    return JSON.stringify({
      probeStage: p.stage, probeWallet: p.wallet, probeCollected: p.collected,
      save: JSON.parse(localStorage.getItem('yatmangai.save.v1'))
    });
  `);

  out.before = await evJ(`
    var p = JSON.parse(window.__probe());
    return JSON.stringify({
      stage: p.stage, year: document.getElementById('year').textContent,
      stageName: document.getElementById('stageName').textContent,
      wallet: p.wallet, collected: p.collected,
      coinsText: document.getElementById('coins').textContent,
      bigCount: document.getElementById('bigCount').textContent,
      chips: document.querySelectorAll('#bigRow .chip').length,
      save: localStorage.getItem('yatmangai.save.v1')
    });
  `);

  // ---- 2. the main row no longer carries a sound button ---------------------
  out.row = await evJ(`
    var row = document.querySelector('.btnRow');
    return JSON.stringify({
      ids: Array.prototype.map.call(row.children, function (b) { return b.id; }),
      hasSoundBtn: !!document.getElementById('soundBtn'),
      settingsBtnText: document.getElementById('settingsBtn').textContent
    });
  `);

  // ---- 3. open the settings overlay ---------------------------------------
  out.opened = await ev(`document.getElementById('settingsBtn').click(); return 'clicked';`);
  await sleep(320);
  out.openState = await evJ(`
    var d = document.getElementById('settings');
    return JSON.stringify({
      on: d.classList.contains('on'),
      isOv: d.classList.contains('ov'),
      role: d.getAttribute('role'),
      modal: d.getAttribute('aria-modal'),
      labelled: d.getAttribute('aria-labelledby'),
      display: getComputedStyle(d).display,
      title: document.getElementById('settingsTitle').textContent,
      closeText: document.getElementById('settingsClose').textContent,
      focusId: document.activeElement && document.activeElement.id,
      focusInside: d.contains(document.activeElement),
      muted: window.UI.isMuted(),
      ariaChecked: document.getElementById('soundToggle').getAttribute('aria-checked'),
      switchRole: document.getElementById('soundToggle').getAttribute('role'),
      toggleText: document.getElementById('soundToggleState').textContent,
      resetWhat: document.getElementById('resetWhat').textContent,
      resetText: document.getElementById('settingsReset').textContent,
      hint: document.getElementById('resetHint').textContent
    });
  `);

  // ---- 4. sound toggle round-trip ------------------------------------------
  out.sound = await evJ(`
    var t = document.getElementById('soundToggle');
    t.click();
    var off = { muted: window.UI.isMuted(), aria: t.getAttribute('aria-checked'),
                txt: document.getElementById('soundToggleState').textContent };
    t.click();
    var on = { muted: window.UI.isMuted(), aria: t.getAttribute('aria-checked'),
               txt: document.getElementById('soundToggleState').textContent };
    return JSON.stringify({ off: off, on: on });
  `);

  // ---- 5. first tap arms only, does NOT reset ------------------------------
  out.armed = await evJ(`
    var b = document.getElementById('settingsReset');
    b.click();
    return JSON.stringify({
      text: b.textContent, armed: b.classList.contains('armed'),
      aria: b.getAttribute('aria-label'),
      hint: document.getElementById('resetHint').textContent,
      probeStage: JSON.parse(window.__probe()).stage,
      probeCollected: JSON.parse(window.__probe()).collected,
      saveStillOld: localStorage.getItem('yatmangai.save.v1')
    });
  `);

  // ---- 6. auto-disarm after 3s --------------------------------------------
  await sleep(3400);
  out.disarmed = await evJ(`
    var b = document.getElementById('settingsReset');
    return JSON.stringify({
      text: b.textContent, armed: b.classList.contains('armed'),
      aria: b.getAttribute('aria-label'),
      hint: document.getElementById('resetHint').textContent,
      probeStage: JSON.parse(window.__probe()).stage,
      wallet: JSON.parse(window.__probe()).wallet,
      collected: JSON.parse(window.__probe()).collected,
      saveStillOld: localStorage.getItem('yatmangai.save.v1')
    });
  `);

  // ---- 7. real reset: arm then confirm inside 3s ---------------------------
  out.resetClick = await evJ(`
    var b = document.getElementById('settingsReset');
    b.click();
    var mid = { text: b.textContent, armed: b.classList.contains('armed') };
    b.click();
    var raw = localStorage.getItem('yatmangai.save.v1');
    return JSON.stringify({ mid: mid, saveAfter: raw ? JSON.parse(raw) : null,
      rawAfter: raw, hint: document.getElementById('resetHint').textContent });
  `);
  await sleep(700);
  out.after = await evJ(`
    var p = JSON.parse(window.__probe());
    var raw = localStorage.getItem('yatmangai.save.v1');
    return JSON.stringify({
      stage: p.stage, year: document.getElementById('year').textContent,
      stageName: document.getElementById('stageName').textContent,
      wallet: p.wallet, collected: p.collected,
      coinsText: document.getElementById('coins').textContent,
      bigCount: document.getElementById('bigCount').textContent,
      storySeen: Object.keys(window.UI.state.storySeen).length,
      found: window.UI.state.found.length,
      simCoins: p.coins,
      save: raw ? JSON.parse(raw) : null,
      rawSave: raw,
      resetText: document.getElementById('settingsReset').textContent,
      resetWhat: document.getElementById('resetWhat').textContent,
      doneOn: document.getElementById('done').classList.contains('on')
    });
  `);

  // ---- 8. Tab is trapped inside the open overlay ---------------------------
  out.tab = await evJ(`
    var focusables = document.getElementById('settings')
      .querySelectorAll('button,[href],input,select,textarea,[tabindex]');
    var last = focusables[focusables.length - 1];
    last.focus();
    var before = document.activeElement.id;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    return JSON.stringify({
      count: focusables.length,
      ids: Array.prototype.map.call(focusables, function (f) { return f.id; }),
      lastId: before, nowId: document.activeElement.id,
      stillInside: document.getElementById('settings').contains(document.activeElement)
    });
  `);

  // ---- 9. Esc closes, focus returns to 設定 -------------------------------
  await ev(`document.getElementById('settingsReset').focus(); return 1`);
  out.esc = await ev(`
    var e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    return String(e.defaultPrevented);
  `);
  await sleep(220);
  out.escState = await evJ(`
    var d = document.getElementById('settings');
    return JSON.stringify({
      on: d.classList.contains('on'),
      focusId: document.activeElement && document.activeElement.id,
      hudInert: document.getElementById('hud').hasAttribute('inert'),
      hudAriaHidden: document.getElementById('hud').getAttribute('aria-hidden')
    });
  `);

  // ---- 10. backdrop click closes ------------------------------------------
  out.backdrop = await evJ(`
    document.getElementById('settingsBtn').click();
    var d = document.getElementById('settings');
    var wasOpen = d.classList.contains('on');
    d.click();                               // target === overlay itself
    var closedByBackdrop = !d.classList.contains('on');
    document.getElementById('settingsBtn').click();
    var row = document.getElementById('settingsScroll');
    var inner = row.querySelector('.setGroup');
    inner.click();                            // click inside must NOT close
    var stillOpen = d.classList.contains('on');
    document.getElementById('settingsClose').click();
    return JSON.stringify({ wasOpen: wasOpen, closedByBackdrop: closedByBackdrop,
      stillOpenOnInnerClick: stillOpen, closedByBtn: !d.classList.contains('on') });
  `);

  // ---- 11. still works: museum + slap --------------------------------------
  out.regress = await evJ(`
    var p0 = JSON.parse(window.__probe());
    var meter0 = document.getElementById('slapFill').getBoundingClientRect();
    document.getElementById('museumBtn').click();
    var m = document.getElementById('museum');
    var mOpen = m.classList.contains('on');
    var gridCards = document.querySelectorAll('#museumGrid .mu').length;
    document.getElementById('museumClose').click();
    var mClosed = !m.classList.contains('on');
    document.getElementById('slapBtn').click();
    var p1 = JSON.parse(window.__probe());
    var meter1 = document.getElementById('slapFill').getBoundingClientRect();
    return JSON.stringify({
      mOpen: mOpen, mClosed: mClosed, gridCards: gridCards,
      slapBefore: p0.slap, slapAfter: p1.slap,
      meterH: meter1.height, meterW: meter1.width,
      meterVisible: meter1.height > 0 && meter1.width > 0,
      slapLabel: document.getElementById('slapBtn').getAttribute('aria-label'),
      slapNText: document.getElementById('slapN').textContent
    });
  `);
  await sleep(400);
  out.slapLater = await evJ(`
    return JSON.stringify({
      slap: JSON.parse(window.__probe()).slap,
      label: document.getElementById('slapBtn').getAttribute('aria-label')
    });
  `);

  // ---- 12. collect card still opens (reset it first, then trigger a big payout)
  out.card = await evJ(`
    var Sim = window.Sim;
    var before = window.UI.state.collected;
    window.Sim.onBigPayout.call(null, { prop: 'sodaCase' });
    return JSON.stringify({ cardOn: document.getElementById('card').classList.contains('on'),
      name: document.getElementById('cardName').textContent });
  `);
  await sleep(200);
  out.cardState = await evJ(`
    return JSON.stringify({
      cardOn: document.getElementById('card').classList.contains('on'),
      name: document.getElementById('cardName').textContent,
      collected: Object.keys(window.UI.state.collected).length
    });
  `);
  await ev(`document.getElementById('cardClose').click(); return 1`);

  // ---- 13. reload proves the save on disk is really fresh ------------------
  await send('Page.navigate', { url: URL_ }, sessionId);
  await sleep(4200);
  out.reloaded = await evJ(`
    var p = JSON.parse(window.__probe());
    return JSON.stringify({
      stage: p.stage, year: document.getElementById('year').textContent,
      wallet: p.wallet, collected: p.collected,
      coinsText: document.getElementById('coins').textContent,
      storySeen: Object.keys(window.UI.state.storySeen).length
    });
  `);

  // ---- 14. phone layout ---------------------------------------------------
  out.layout = await evJ(`
    document.getElementById('settingsBtn').click();
    return JSON.stringify({ opened: document.getElementById('settings').classList.contains('on') });
  `);
  await sleep(260);
  out.phone = await evJ(`
    var d = document.getElementById('settings');
    var ids = ['settingsClose', 'settingsReset', 'soundToggle'];
    var rects = {};
    ids.forEach(function (id) {
      var r = document.getElementById(id).getBoundingClientRect();
      rects[id] = { w: Math.round(r.width), h: Math.round(r.height),
                    top: Math.round(r.top), bottom: Math.round(r.bottom),
                    inView: r.top >= 0 && r.bottom <= innerHeight + 1 };
    });
    var sc = document.getElementById('settingsScroll');
    var dr = d.getBoundingClientRect();
    return JSON.stringify({
      vw: innerWidth, vh: innerHeight,
      docScrollH: document.documentElement.scrollHeight,
      docScrollW: document.documentElement.scrollWidth,
      pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
      overflowsX: document.documentElement.scrollWidth > innerWidth + 1,
      overlay: { w: Math.round(dr.width), h: Math.round(dr.height) },
      scrollBody: { clientH: sc.clientHeight, scrollH: sc.scrollHeight,
                    scrolls: sc.scrollHeight > sc.clientHeight + 1 },
      rects: rects,
      minBtnH: Math.min(rects.settingsClose.h, rects.settingsReset.h, rects.soundToggle.h),
      allInView: rects.settingsClose.inView && rects.settingsReset.inView && rects.soundToggle.inView,
      rowBtns: Array.prototype.map.call(document.querySelector('.btnRow').children, function (b) {
        var r = b.getBoundingClientRect();
        return { id: b.id, h: Math.round(r.height), w: Math.round(r.width),
                 fits: r.right <= innerWidth + 1 && r.left >= -1 };
      })
    });
  `);

  if (shotPath) {
    const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    if (cap.result?.data) {
      mkdirSync(dirname(shotPath), { recursive: true });
      writeFileSync(shotPath, Buffer.from(cap.result.data, 'base64'));
    }
  }

  console.log(JSON.stringify({ logs, out }, null, 2));
  ws.close();
  child.kill();
  process.exit(0);
}

main().catch(e => {
  console.error('HARNESS FAIL', e.message, e.stack);
  child.kill();
  process.exit(1);
});
