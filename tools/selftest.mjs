/* Run ?selftest and report the console verdict.
 * The suite is the only thing standing between "it renders" and "it works".
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PORT = 9000 + Math.floor(Math.random() * 900);
const url = 'https://osman3n.github.io/hk-coin-pusher/?selftest';
const proc = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0, sessionId = null;
const pending = new Map(), lines = [], errors = [];
function send(m, p = {}, sid) { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: sid })); return new Promise(r => pending.set(i, r)); }
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
  if (m.method === 'Runtime.consoleAPICalled') lines.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
};
await send('Target.setDiscoverTargets', { discover: true });
const t = await send('Target.createTarget', { url: 'about:blank' });
await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
for (let i = 0; i < 40 && !sessionId; i++) await sleep(50);
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Page.navigate', { url }, sessionId);
await sleep(9000);

const total = lines.filter(l => /^PASS |^FAIL /.test(l)).length;
const fails = lines.filter(l => l.startsWith('FAIL'));
const verdict = lines.find(l => l.startsWith('SELFTEST')) || 'SELFTEST never printed';
const perf = lines.find(l => /ms$/.test(l) && /300 coins/.test(l));

for (const l of lines.filter(l => /^PASS |^FAIL |^SELFTEST|^FAILED/.test(l))) console.log(l);
console.log('---');
console.log(verdict);
if (perf) console.log(perf);
if (errors.length) console.log('PAGE ERRORS', JSON.stringify(errors.slice(0, 5)));
try { ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); } catch {}
proc.kill();
process.exit(fails.length || errors.length || !/SELFTEST OK/.test(verdict) ? 1 : 0);
