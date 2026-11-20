// Does opening the settings page actually move focus (and restore it on close)?
import { spawn } from 'node:child_process';
const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL_ = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 400);
const child = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`,
  '--window-size=390,844', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
let wsUrl = null;
child.stderr.on('data', b => { const m = /ws:\/\/[^\s]+/.exec(b.toString()); if (m) wsUrl = m[0]; });

const main = async () => {
  for (let i = 0; i < 120 && !wsUrl; i++) await sleep(100);
  const ws = new WebSocket(wsUrl);
  const waiters = new Map(); let sid = null;
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  let n = 1;
  const send = (method, params = {}, s) => new Promise(res => {
    const id = n++; waiters.set(id, res);
    ws.send(JSON.stringify(s ? { id, method, params, sessionId: s } : { id, method, params }));
  });
  await send('Target.setDiscoverTargets', { discover: true });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  sid = att.result.sessionId;
  await send('Runtime.enable', {}, sid);
  await send('Page.enable', {}, sid);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sid);
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: `(function(){${expr}})()`, returnByValue: true, awaitPromise: true }, sid);
    if (r.result?.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  await send('Page.navigate', { url: URL_ }, sid);
  await sleep(4200);
  await ev(`document.getElementById('sGo').click(); return 1`);
  await sleep(300);
  const probe = (label) => `return JSON.stringify({ label: '${label}',
    active: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
    hasFocus: document.hasFocus(),
    on: document.getElementById('settings').classList.contains('on') })`;
  const out = {};
  out.before = await ev(probe('before'));
  await ev(`window.__f = []; document.addEventListener('focusin', function(e){ window.__f.push((e.target.id||e.target.tagName)); }); return 1`);
  await ev(`document.getElementById('settingsBtn').click(); return 1`);
  await sleep(60); out.at60 = await ev(probe('at60'));
  await sleep(140); out.at200 = await ev(probe('at200'));
  await sleep(600); out.at800 = await ev(probe('at800'));
  out.focusEvents = await ev(`return JSON.stringify(window.__f)`);
  out.manual = await ev(`
    var a = document.getElementById('settingsClose');
    a.focus({ preventScroll: true });
    return JSON.stringify({ active: document.activeElement.id, connected: a.isConnected,
      rects: a.getClientRects().length, tabIndex: a.tabIndex, disabled: a.disabled,
      inertAncestor: !!a.closest('[inert]') });
  `);
  out.close = await ev(`
    document.getElementById('settingsClose').click();
    return JSON.stringify({ on: document.getElementById('settings').classList.contains('on') });
  `);
  await sleep(200);
  out.afterClose = await ev(probe('afterClose'));
  out.focusEvents2 = await ev(`return JSON.stringify(window.__f)`);
  console.log(JSON.stringify(out, null, 2));
  ws.close(); child.kill(); process.exit(0);
};
main().catch(e => { console.error('FAIL', e.stack); child.kill(); process.exit(1); });
