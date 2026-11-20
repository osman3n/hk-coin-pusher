// Edge cases that the happy path hides:
//  - reset while a collect card is open and a tick animation is mid-flight
//  - reset then a stage advance (done card) still works
//  - reset then reload (save on disk must be the new one)
//  - the chip row repaints for 1972, not the old stage
import { spawn } from 'node:child_process';

const arg = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const SHELL = arg('shell',
  'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe');
const URL_ = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 400);

const child = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, '--window-size=390,844', 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let wsUrl = null;
child.stderr.on('data', b => { const m = /ws:\/\/[^\s]+/.exec(b.toString()); if (m) wsUrl = m[0]; });

async function main() {
  for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
  const ws = new WebSocket(wsUrl);
  const waiters = new Map(); const logs = []; let sessionId = null;
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
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);

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

  const goto = async () => {
    await send('Page.navigate', { url: URL_ }, sessionId);
    await sleep(4200);
    await ev(`document.getElementById('sGo').click(); return 1`);
    await sleep(400);
  };
  await goto();
  const out = {};

  // ---- A. reset while a collect card is open and the counter is animating ---
  out.a = await evJ(`
    var b = window.__bot, S = window.UI.state;
    b.applyStage(5, true);
    S.stageIdx = 5;
    b.state.coins = 900;
    window.UI.tick(900);                 // starts a roll-up animation
    window.Sim.onBigPayout({ prop: window.CONTENT.STAGES[5].big[0] });
    var stBefore = { stage: b.state.stageIdx, card: document.getElementById('card').classList.contains('on') };
    document.getElementById('settingsBtn').click();
    var rb = document.getElementById('settingsReset');
    rb.click(); rb.click();
    var immediately = { coins: document.getElementById('coins').textContent,
                        year: document.getElementById('year').textContent };
    return JSON.stringify({ stBefore: stBefore, immediately: immediately });
  `);
  await sleep(600);   // let any stale animation finish
  out.aSettled = await evJ(`
    var p = JSON.parse(window.__probe());
    var chips = document.querySelectorAll('#bigRow .chip');
    var ids = Array.prototype.map.call(chips, function (c) { return c.dataset.id; });
    var stage0ids = window.CONTENT.STAGES[0].big.concat(window.CONTENT.STAGES[0].small);
    return JSON.stringify({
      coins: document.getElementById('coins').textContent,
      wallet: p.wallet, stage: p.stage, collected: p.collected,
      cardOn: document.getElementById('card').classList.contains('on'),
      doneOn: document.getElementById('done').classList.contains('on'),
      chipCount: chips.length,
      chipsAre1972: ids.join(',') === stage0ids.join(','),
      save: JSON.parse(localStorage.getItem('yatmangai.save.v1'))
    });
  `);
  await ev(`document.getElementById('settingsClose').click(); return 1`);

  // ---- B. next stage after a reset advances 1972 -> 1980 ------------------
  out.b = await evJ(`
    var p0 = JSON.parse(window.__probe());
    window.UI.onNextStage();
    var p1 = JSON.parse(window.__probe());
    return JSON.stringify({
      before: { stage: p0.stage, year: document.getElementById('year').textContent },
      after: { stage: p1.stage, year: document.getElementById('year').textContent },
      save: JSON.parse(localStorage.getItem('yatmangai.save.v1'))
    });
  `);

  // ---- C. reset, reload, and confirm the disk save is the fresh one -------
  await ev(`
    document.getElementById('settingsBtn').click();
    var rb = document.getElementById('settingsReset'); rb.click(); rb.click();
    document.getElementById('settingsClose').click();
    return 1;
  `);
  out.cBeforeReload = await evJ(`
    return JSON.stringify({ save: localStorage.getItem('yatmangai.save.v1'),
      year: document.getElementById('year').textContent });
  `);
  await send('Page.navigate', { url: URL_ }, sessionId);
  await sleep(4200);
  out.cAfterReload = await evJ(`
    var p = JSON.parse(window.__probe());
    return JSON.stringify({ stage: p.stage, year: document.getElementById('year').textContent,
      wallet: p.wallet, collected: p.collected,
      coins: document.getElementById('coins').textContent,
      storySeen: Object.keys(window.UI.state.storySeen).length });
  `);

  // ---- D. settings survives a reload and the switch reflects real state ----
  out.d = await evJ(`
    window.UI.setMuted(true);
    document.getElementById('settingsBtn').click();
    var t = document.getElementById('soundToggle');
    var first = { aria: t.getAttribute('aria-checked'), txt: document.getElementById('soundToggleState').textContent };
    t.click();
    var second = { aria: t.getAttribute('aria-checked'), txt: document.getElementById('soundToggleState').textContent,
                   muted: window.UI.isMuted() };
    document.getElementById('settingsClose').click();
    return JSON.stringify({ first: first, second: second });
  `);

  // ---- E. rapid double-open / double-close does not wedge the page -------
  out.e = await evJ(`
    var s = document.getElementById('settings');
    document.getElementById('settingsBtn').click();
    document.getElementById('settingsBtn').click();
    var opened = s.classList.contains('on');
    document.getElementById('settingsClose').click();
    document.getElementById('settingsClose').click();
    var closed = !s.classList.contains('on');
    var hudInert = document.getElementById('hud').hasAttribute('inert');
    return JSON.stringify({ opened: opened, closed: closed, hudInert: hudInert,
      focus: document.activeElement && document.activeElement.id });
  `);

  console.log(JSON.stringify({ logs, out }, null, 2));
  ws.close(); child.kill(); process.exit(0);
}
main().catch(e => { console.error('HARNESS FAIL', e.message, e.stack); child.kill(); process.exit(1); });
