/* Play the game the way a player does, headless, and report what actually
 * happened: coins dropped, payouts, props surfaced, collect cards shown.
 *
 *   node tools/play.mjs [drops] [--shot=out.png]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html';
const drops = +(process.argv[2] || 40);
const shotArg = process.argv.find(a => a.startsWith('--shot='));
const shotPath = shotArg ? shotArg.slice(7) : null;
const outArg = process.argv.find(a => a.startsWith('--out='));
const port = 9000 + Math.floor(Math.random() * 800);

const child = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, '--window-size=1280,800', 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = ''; child.stderr.on('data', d => { stderr += d; });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0; const pending = new Map(); const logs = [];

async function main() {
  let wsUrl;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; }
    } catch (e) {}
    await sleep(100);
  }
  if (!wsUrl) throw new Error('no devtools\n' + stderr.slice(-800));

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}, sessionId) => new Promise(res => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
  let sess = null;
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Target.attachedToTarget') { sess = m.params.sessionId; return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push('PAGEERROR ' + (d.exception?.description || d.text));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      logs.push('CONSOLE ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
  };

  await send('Target.setDiscoverTargets', { discover: true });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  sess = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  await send('Runtime.enable', {}, sess);
  await send('Page.enable', {}, sess);
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sess);
  await send('Page.navigate', { url: URL }, sess);
  await sleep(3500);

  const evaluate = async expr => {
    const r = await send('Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true }, sess);
    if (r.result?.exceptionDetails) {
      return 'EVALERROR ' + (r.result.exceptionDetails.exception?.description || '');
    }
    return r.result?.result?.value;
  };

  // 1. press the start button the way a player does
  await evaluate(`document.getElementById('sGo').click(); 'clicked'`);
  await sleep(600);

  // 2. drop coins at varying x, letting the world step between them
  for (let i = 0; i < drops; i++) {
    const x = (i % 5) * 0.18 - 0.36;
    await evaluate(`(function(){
      var e = new PointerEvent('pointerdown',{clientX:${640 + x * 700},clientY:430,bubbles:true,pointerId:1});
      document.getElementById('c').dispatchEvent(e);
      document.getElementById('c').dispatchEvent(new PointerEvent('pointerup',{clientX:${640 + x * 700},clientY:430,bubbles:true,pointerId:1}));
      return 1;
    })()`);
    await sleep(190);
  }

  // 3. let it settle and pay out
  await sleep(4000);

  const probe = await evaluate('window.__probe ? window.__probe() : "no probe"');
  const hud = await evaluate(`JSON.stringify({
    coins: document.getElementById('coins').textContent,
    year: document.getElementById('year').textContent,
    stage: document.getElementById('stageName').textContent,
    machine: document.getElementById('machine').textContent,
    cardOpen: document.getElementById('card').classList.contains('on'),
    cardName: document.getElementById('cardName').textContent
  })`);

  if (shotPath) {
    const cap = await send('Page.captureScreenshot', { format: 'png' }, sess);
    if (cap.result?.data) {
      mkdirSync(dirname(shotPath), { recursive: true });
      writeFileSync(shotPath, Buffer.from(cap.result.data, 'base64'));
    }
  }

  const report = { probe: JSON.parse(probe.startsWith('{') ? probe : '{}'), hud: JSON.parse(hud), errors: logs };
  if (outArg) writeFileSync(outArg.slice(6), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  ws.close(); child.kill(); process.exit(0);
}

main().catch(e => { console.error('PLAY FAIL', e.message); child.kill(); process.exit(1); });
