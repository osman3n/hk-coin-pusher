/* CDP harness: launch headless shell, open a URL, capture console + errors,
 * evaluate an expression, print JSON. No npm deps — Node 24 has WebSocket.
 *
 *   node tools/cdp.mjs <url> [--eval=<expr>] [--wait=<ms>] [--shot=<png>]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const url = process.argv[2];
const argOf = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const SHELL = argOf('shell',
  'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe');
const evalExpr = argOf('eval', null);
const waitMs = +(argOf('wait', '3500'));
const shotPath = argOf('shot', null);
const port = 9000 + Math.floor(Math.random() * 800);

const child = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, '--window-size=1280,800', 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let stderr = '';
child.stderr.on('data', d => { stderr += d.toString(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('devtools never came up\n' + stderr.slice(-1200));
}

const logs = [];
let id = 0;
const pending = new Map();

async function main() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  const send = (method, params = {}, sessionId) => new Promise(res => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });

  let sessionId = null;
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Target.attachedToTarget') {
      sessionId = msg.params.sessionId;
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(`${msg.params.type.toUpperCase()} ` +
        msg.params.args.map(a => a.value ?? a.description ?? a.unserializableValue ?? '').join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push('PAGEERROR ' + (d.exception?.description || d.text));
    }
    if (msg.method === 'Log.entryAdded') {
      logs.push(`LOG[${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
  };

  await send('Target.setDiscoverTargets', { discover: true });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  sessionId = att.result.sessionId;

  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);

  await send('Page.navigate', { url }, sessionId);
  await sleep(waitMs);

  let evalOut = null;
  if (evalExpr) {
    const r = await send('Runtime.evaluate',
      { expression: evalExpr, returnByValue: true, awaitPromise: true }, sessionId);
    evalOut = r.result?.result?.value ?? r.result?.result?.description ??
      (r.result?.exceptionDetails ? 'EVALERROR ' + r.result.exceptionDetails.text +
        ' ' + (r.result.exceptionDetails.exception?.description || '') : null);
  }

  if (shotPath) {
    const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    if (cap.result?.data) {
      mkdirSync(dirname(shotPath), { recursive: true });
      writeFileSync(shotPath, Buffer.from(cap.result.data, 'base64'));
    }
  }

  console.log(JSON.stringify({ logs, eval: evalOut }, null, 2));
  ws.close();
  child.kill();
  process.exit(0);
}

main().catch(e => {
  console.error('HARNESS FAIL', e.message);
  child.kill();
  process.exit(1);
});
