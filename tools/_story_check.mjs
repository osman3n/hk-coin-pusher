import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __d = dirname(fileURLToPath(import.meta.url));
const root = join(__d, '..');
const SHELL = process.env.CHROME_SHELL || 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const url = 'file:///' + join(root, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20') + '?bot';
const port = 9800 + Math.floor(Math.random() * 150);
const proc = spawn(SHELL, ['--headless','--disable-gpu','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${port}`,'--window-size=1280,800','about:blank'], { stdio: 'ignore' });
let ver = null;
for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = new Map(); const errs = [];
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const mit = await send('Target.createTarget', { url: 'about:blank' });
const at = await send('Target.attachToTarget', { targetId: mit.result.targetId, flatten: true });
const S = at.result.sessionId;
await send('Page.enable', {}, S); await send('Runtime.enable', {}, S);
await send('Page.navigate', { url }, S);
for (let i = 0; i < 150; i++) { const r = await send('Runtime.evaluate', { expression: '!!(window.__bot&&window.Sim&&window.UI)', returnByValue: true }, S); if (r.result?.result?.value) break; await sleep(200); }
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, S)).result?.result?.value;
await ev(`document.getElementById('sGo').click();`);
await sleep(1200);
const start = await ev(`(function(){var e=document.getElementById('sStory'); return e? e.innerText.replace(/\\s+/g,' ').trim().slice(0,120):'(none)';})()`);
await ev(`document.getElementById('museumBtn').click();`);
await sleep(400);
await ev(`document.getElementById('mtabStory').click();`);
await sleep(400);
const story = await ev(`(function(){
  var b=document.getElementById('museumStory');
  var rows=[]; if(b) b.querySelectorAll('*').forEach(function(el){ if(el.children.length===0 && el.textContent.trim()) rows.push(el.textContent.trim()); });
  return {hidden:b?b.hidden:null, lines:rows.slice(0,20), textLen: b?b.innerText.length:0};
})()`);
const tabs = await ev(`(function(){var g=document.getElementById('mtabGrid'),s=document.getElementById('mtabStory');
  return {grid:g?g.getAttribute('aria-pressed'):null, story:s?s.getAttribute('aria-pressed'):null,
          storyHidden:document.getElementById('museumStory').hidden, gridHidden:document.getElementById('museumGrid').hidden};})()`);
// stage-done screen stats
await ev(`document.getElementById('museumClose').click();`);
await sleep(300);
const done = await ev(`(function(){
  var b=window.__bot; var st=window.Sim.STAGES; b.state.collected={};
  window.Sim.stats.dropped=12; window.Sim.stats.paid=9; window.Sim.stats.shuttled=3;
  window.UI.showStageDone(window.CONTENT.STAGES[0], false, {drops:12, paid:9, lost:3, got:2, total:9});
  var d=document.getElementById('done');
  var stats=document.getElementById('doneStats');
  var beat=document.getElementById('doneBeat');
  return {doneHidden:d?d.hidden:null, stats:stats?stats.innerText.replace(/\\s+/g,' ').trim():null, beat:beat?beat.innerText.replace(/\\s+/g,' ').trim():null};
})()`);
console.log(JSON.stringify({ startScreen: start, storyTab: tabs, story: story, done: done, errors: errs }, null, 1));
try { await send('Browser.close'); } catch {}
ws.close(); proc.kill();
