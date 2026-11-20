/* Contact sheet of every collection prop.
 *
 * The brief was "build the 3d model better", which is not actionable until you
 * can see all 61 side by side at the size a player actually meets them. This
 * renders each builder with R.thumb() and pastes them into one PNG, labelled,
 * so the weak ones are obvious rather than theoretical.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PAGE = process.env.GAME_URL || 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html';
const out = process.argv.find(a => a.startsWith('--out='));
const OUT = out ? out.slice(6) : 'shots/props/sheet.png';
const COLS = +(process.argv.find(a => a.startsWith('--cols=')) || '--cols=8').slice(7);
const CELL = +(process.argv.find(a => a.startsWith('--cell=')) || '--cell=150').slice(7);
// --page=N renders just one sheetful, so a big set can be inspected at a size
// where the modelling actually shows. 0 (the default) means everything.
const SHEET = +(process.argv.find(a => a.startsWith('--page=')) || '--page=0').slice(7);
const PER = +(process.argv.find(a => a.startsWith('--per=')) || '--per=16').slice(6);

const PORT = 9000 + Math.floor(Math.random() * 900);
const proc = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--window-size=400,400', 'about:blank'
], { stdio: 'ignore' });

let ws, id = 0, sessionId = null;
const pending = new Map();
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
for (let i = 0; i < 120; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) { ws = new WebSocket((await r.json()).webSocketDebuggerUrl); break; } } catch {}
  await sleep(100);
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Target.attachedToTarget') sessionId = m.params.sessionId;
};
await send('Target.setDiscoverTargets', { discover: true });
const t = await send('Target.createTarget', { url: 'about:blank' });
await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
for (let i = 0; i < 40 && !sessionId; i++) await sleep(50);
await send('Runtime.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Page.navigate', { url: PAGE }, sessionId);
await sleep(4000);

// Build the sheet in-page: every thumb() as an <img> on a canvas, labelled.
const data = await evaluate(`(function(){
  var R = window.R, C = window.CONTENT;
  var ids = Object.keys(R.PROP_BUILD);
  return JSON.stringify(ids.map(function(id){
    var prop = C.PROPS[id] || {};
    var src = '';
    try { src = R.thumb(id); } catch (e) { src = ''; }
    return { id: id, name: prop.name || id, big: !!prop.big,
             owner: prop.owner || '', len: src.length, src: src };
  }));
})()`);
let items = JSON.parse(data);
if (SHEET > 0) items = items.slice((SHEET - 1) * PER, SHEET * PER);
const broken = items.filter(i => !i.len);
if (broken.length) console.log('EMPTY THUMBS: ' + broken.map(b => b.id).join(', '));
const errs = await evaluate('JSON.stringify((window.G && window.G.__propErrors) || [])');
const el = JSON.parse(errs || '[]');
if (el.length) console.log('BUILD ERRORS: ' + el.join(' | '));

const COLS_N = COLS;
const rows = Math.ceil(items.length / COLS_N);
const W = COLS_N * CELL, H = rows * CELL;

const page2 = await evaluate(`(function(items, cols, cell, w, h){
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.fillStyle = '#171310'; g.fillRect(0,0,w,h);
  return new Promise(function(res){
    var left = items.length, imgs = [];
    items.forEach(function(it, i){
      var im = new Image();
      im.onload = function(){
        var col = i % cols, row = Math.floor(i / cols);
        g.drawImage(im, col*cell, row*cell, cell, cell);
        g.strokeStyle = it.big ? 'rgba(217,164,65,.75)' : 'rgba(242,230,208,.14)';
        g.lineWidth = it.big ? 2 : 1;
        g.strokeRect(col*cell+0.5, row*cell+0.5, cell-1, cell-1);
        g.font = '11px sans-serif';
        g.fillStyle = it.big ? '#f2d79a' : '#a89a86';
        g.fillText(it.name.slice(0, 12), col*cell + 5, row*cell + cell - 6);
        imgs.push(1);
        if (--left === 0) res(c.toDataURL('image/png'));
      };
      im.onerror = function(){ if (--left === 0) res(c.toDataURL('image/png')); };
      im.src = it.src || '';
    });
    if (!items.length) res(c.toDataURL('image/png'));
  });
})(${JSON.stringify(items.map(i => ({ src: i.src, name: i.name, big: i.big })))}, ${COLS_N}, ${CELL}, ${W}, ${H})`);

if (!page2) { console.log('sheet render failed'); proc.kill(); process.exit(1); }
mkdirSync('shots/props', { recursive: true });
const dest = SHEET > 0 ? OUT.replace(/\.png$/, '-p' + SHEET + '.png') : OUT;
writeFileSync(dest, Buffer.from(page2.split(',')[1], 'base64'));
console.log('wrote ' + dest + '  (' + items.length + ' props, ' + W + 'x' + H + ')');
console.log('big: ' + items.filter(i => i.big).length + '  small: ' + items.filter(i => !i.big).length);
proc.kill();
process.exit(0);
