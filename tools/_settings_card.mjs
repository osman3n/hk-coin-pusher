// Focused re-check of the two things the first run probed wrong:
// (a) collect card still opens (first run passed the wrong key to onBigPayout),
// (b) the stage-done overlay still advances/runs after a reset.
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

  // card: real payout path, with a real prop id from the current stage
  out.card = await evJ(`
    var st = window.CONTENT.STAGES[0];
    var id = st.big[0];
    document.getElementById('sGo') && document.getElementById('sGo').click();
    window.Sim.onBigPayout({ prop: id });
    return JSON.stringify({ propId: id, coinsAfter: window.__bot.state.coins,
      cardOn: document.getElementById('card').classList.contains('on'),
      name: document.getElementById('cardName').textContent });
  `);
  await sleep(250);
  out.cardOpen = await evJ(`
    return JSON.stringify({
      cardOn: document.getElementById('card').classList.contains('on'),
      name: document.getElementById('cardName').textContent,
      collected: Object.keys(window.UI.state.collected),
      busy: window.Sim.busy,
      save: JSON.parse(localStorage.getItem('yatmangai.save.v1') || 'null')
    });
  `);
  out.cardClosed = await evJ(`
    document.getElementById('cardClose').click();
    return JSON.stringify({ cardOn: document.getElementById('card').classList.contains('on'),
      busy: window.Sim.busy });
  `);
  await sleep(400);
  out.afterCard = await evJ(`
    return JSON.stringify({
      busy: window.Sim.busy,
      doneOn: document.getElementById('done').classList.contains('on'),
      save: JSON.parse(localStorage.getItem('yatmangai.save.v1') || 'null')
    });
  `);

  // reset while the collection is non-empty, then confirm the card path still works
  out.resetThenCard = await evJ(`
    var before = { stage: window.__bot.state.stageIdx, collected: Object.keys(window.UI.state.collected).length,
                   wallet: window.__bot.state.coins };
    document.getElementById('settingsBtn').click();
    var b = document.getElementById('settingsReset');
    b.click(); b.click();
    var afterReset = { stage: window.__bot.state.stageIdx, collected: Object.keys(window.UI.state.collected).length,
                       wallet: window.__bot.state.coins,
                       year: document.getElementById('year').textContent };
    document.getElementById('settingsClose').click();
    var st = window.CONTENT.STAGES[0];
    window.Sim.onBigPayout({ prop: st.big[1] });
    var card = { on: document.getElementById('card').classList.contains('on'),
                 name: document.getElementById('cardName').textContent };
    document.getElementById('cardClose').click();
    return JSON.stringify({ before: before, afterReset: afterReset, card: card,
      collectedAfterCard: Object.keys(window.UI.state.collected),
      stageStillZero: window.__bot.state.stageIdx === 0,
      save: JSON.parse(localStorage.getItem('yatmangai.save.v1') || 'null') });
  `);

  // museum opens from the fresh world and the story tab still paints
  out.museum = await evJ(`
    document.getElementById('museumBtn').click();
    var m = document.getElementById('museum');
    var open = m.classList.contains('on');
    var cards = document.querySelectorAll('#museumGrid .mu').length;
    document.getElementById('mtabStory').click();
    var storyOn = document.getElementById('museumStory').hidden === false;
    var beats = document.querySelectorAll('#stList .stBeat').length;
    document.getElementById('mtabGrid').click();
    document.getElementById('museumClose').click();
    return JSON.stringify({ open: open, cards: cards, storyOn: storyOn, beats: beats,
      closed: !m.classList.contains('on'), title: document.getElementById('museumTitle').textContent });
  `);

  console.log(JSON.stringify({ logs, out }, null, 2));
  ws.close(); child.kill(); process.exit(0);
}
main().catch(e => { console.error('HARNESS FAIL', e.message, e.stack); child.kill(); process.exit(1); });
