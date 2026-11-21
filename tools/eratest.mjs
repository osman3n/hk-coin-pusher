// Verify the two new doorways:
//   1. the year on the HUD opens a list of every shop the machine stood in,
//      the current one is not tappable, the unreached ones are locked, and a
//      cleared decade offers the next one;
//   2. a reset is followed by a card on the table, not just a line of small
//      print inside a panel nobody is looking at.
//
// Run: node tools/eratest.mjs [--shot=shots/era]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const RAW = process.env.GAME_URL || 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const PAGE = /[?&]bot\b/.test(RAW) ? RAW : RAW + (RAW.indexOf('?') < 0 ? '?' : '&') + 'bot';
const PORT = 9511 + (Math.floor(Math.random() * 400));

const shotArg = process.argv.find((a) => a.startsWith('--shot='));
const SHOT = shotArg ? shotArg.slice(7) : '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader', '--remote-debugging-port=' + PORT,
  '--window-size=1280,800', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
let shellErr = '';
proc.stderr.on('data', (d) => { shellErr += d.toString(); });

const out = { steps: [], errors: [] };
let ws, id = 0, pending = new Map();

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const v = await r.json();
      return v.webSocketDebuggerUrl;
    } catch (e) { await sleep(250); }
  }
  throw new Error('no devtools endpoint on ' + PORT + ' :: ' + shellErr.slice(0, 400));
}

function send(method, params = {}, sessionId) {
  const mid = ++id;
  const msg = { id: mid, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => {
    pending.set(mid, { res, rej });
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('timeout ' + method)); } }, 30000);
  });
}

async function evaluate(expr, session) {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  }, session);
  if (r.exceptionDetails) {
    throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  }
  return r.result ? r.result.value : undefined;
}

async function main() {
  const url = await connect();
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      out.errors.push((d.exception && d.exception.description) || d.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      out.errors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
    }
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
  await send('Page.navigate', { url: PAGE }, sessionId);
  await sleep(3500);

  // start the game
  for (let i = 0; i < 15; i++) {
    const ok = await evaluate(`(function(){var b=document.getElementById('sGo');if(!b)return false;b.click();return !!(window.__bot&&window.__bot.state&&window.__bot.state.started);})()`, sessionId);
    if (ok) break;
    await sleep(400);
  }

  // ── 1. the era list opens from the year ────────────────────────────────
  await evaluate(`document.getElementById('stageBox').click()`, sessionId);
  await sleep(700);
  const eras = await evaluate(`(function(){
    var ov = document.getElementById('eras');
    var on = ov.classList.contains('on');
    var rows = [].map.call(ov.querySelectorAll('.era'), function(r){
      return { y: r.querySelector('.ey').textContent, cls: r.className,
               dis: r.disabled, ev: r.querySelector('.ev').textContent,
               cur: r.getAttribute('aria-current') };
    });
    var next = document.getElementById('erasNext');
    return { on: on, rows: rows, next: next ? next.textContent : null,
             now: document.getElementById('erasNow').textContent.replace(/\\s+/g,' ').trim(),
             focus: document.activeElement ? document.activeElement.id : null };
  })()`, sessionId);
  out.steps.push({ eras: eras });

  if (SHOT) {
    try { mkdirSync(SHOT, { recursive: true }); } catch (e) {}
    const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(SHOT, 'eras.png'), Buffer.from(cap.data, 'base64'));
  }

  // walking to a locked decade must be impossible
  const lockedProbe = await evaluate(`(function(){
    var rows = [].slice.call(document.querySelectorAll('#erasList .era'));
    var locked = rows.filter(function(r){ return /locked/.test(r.className); });
    var before = __bot.state.stageIdx;
    if (locked.length) locked[0].click();
    return { lockedCount: locked.length, stageBefore: before,
             stageAfter: __bot.state.stageIdx,
             stillOpen: document.getElementById('eras').classList.contains('on') };
  })()`, sessionId);
  out.steps.push({ locked: lockedProbe });

  // grant a cleared decade, then the next one must be offered
  const forward = await evaluate(`(function(){
    // pretend 1972 is done: collect its three big ones the way the game would
    // record them (state.collected is the only ledger the UI reads).
    var st = CONTENT.STAGES[0];
    st.big.forEach(function(id){ UI.state.collected[id] = true; });
    UI.closeEras();
    UI.openEras();
    var next = document.getElementById('erasNext');
    var out = { hasNext: !!next, label: next ? next.textContent : null };
    if (next) next.click();
    out.stageAfter = __bot.state.stageIdx;
    out.year = document.getElementById('year').textContent;
    out.erasOpen = document.getElementById('eras').classList.contains('on');
    out.maxStage = UI.state.maxStage;
    out.coinStyle = R.coinStyle();
    return out;
  })()`, sessionId);
  out.steps.push({ forward: forward });
  await sleep(600);

  // ── 2. walking back to an older decade ─────────────────────────────────
  const back = await evaluate(`(function(){
    UI.openEras();
    var rows = [].slice.call(document.querySelectorAll('#erasList .era'));
    var back0 = rows[0];
    var out = { row0: { cls: back0.className, dis: back0.disabled, ev: back0.querySelector('.ev').textContent } };
    back0.click();
    out.stageAfter = __bot.state.stageIdx;
    out.year = document.getElementById('year').textContent;
    out.maxStage = UI.state.maxStage;
    out.coinStyle = R.coinStyle();
    return out;
  })()`, sessionId);
  out.steps.push({ back: back });
  await sleep(500);

  // ── 3. the reset must be visible on the table ──────────────────────────
  const reset = await evaluate(`(function(){
    var before = { stage: __bot.state.stageIdx, coins: __bot.state.coins,
                   got: Object.keys(UI.state.collected).length };
    UI.onReset();
    var ov = document.getElementById('renew');
    var out = { before: before,
      renewOpen: ov.classList.contains('on'),
      year: document.getElementById('renewYear').textContent,
      msg: document.getElementById('renewMsg').textContent,
      stats: document.getElementById('renewStats').textContent.replace(/\\s+/g,' ').trim(),
      after: { stage: __bot.state.stageIdx, coins: __bot.state.coins,
               got: Object.keys(UI.state.collected).length,
               maxStage: UI.state.maxStage, coinStyle: R.coinStyle(),
               saved: localStorage.getItem('yatmangai.save.v1') },
      focus: document.activeElement ? document.activeElement.id : null };
    document.getElementById('renewOk').click();
    out.closed = !document.getElementById('renew').classList.contains('on');
    return out;
  })()`, sessionId);
  out.steps.push({ reset: reset });

  if (SHOT) {
    // capture the card too: re-run the reset so the card is on screen
    await evaluate(`UI.onReset()`, sessionId);
    await sleep(700);
    const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(SHOT, 'renew.png'), Buffer.from(cap.data, 'base64'));
    await evaluate(`document.getElementById('renewOk').click()`, sessionId);
  }

  // ── 4. the era picker must not trap the table ──────────────────────────
  const after = await evaluate(`(function(){
    var p = JSON.parse(__probe ? __probe() : '{}');
    return { started: p.started, stage: p.stage, coins: p.wallet,
             hudInert: document.getElementById('hud').hasAttribute('inert'),
             erasOpen: document.getElementById('eras').classList.contains('on'),
             renewOpen: document.getElementById('renew').classList.contains('on') };
  })()`, sessionId);
  out.steps.push({ after: after });

  console.log(JSON.stringify(out, null, 1));

  // ── assertions ─────────────────────────────────────────────────────────
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const s0 = out.steps[0].eras;
  ok(s0.on, 'era list did not open');
  ok(s0.rows.length === 7, 'era list should have 7 rows, got ' + s0.rows.length);
  ok(s0.rows[0].cur === 'true', 'current era is not marked aria-current');
  ok(s0.rows[0].dis === true, 'current era row should not be tappable');
  ok(/locked/.test(s0.rows[6].cls), 'unreached era should be locked');
  ok(s0.next === null, 'a stage with nothing collected must not offer the next era');

  const lk = out.steps[1].locked;
  ok(lk.lockedCount >= 6, 'expected the unreached eras to be locked, got ' + lk.lockedCount);
  ok(lk.stageBefore === lk.stageAfter, 'a locked era moved the machine');

  const fw = out.steps[2].forward;
  ok(fw.hasNext, 'a cleared decade did not offer the next one');
  ok(fw.stageAfter === 1, 'going forward landed on stage ' + fw.stageAfter);
  ok(fw.erasOpen === false, 'the era list stayed open after moving');
  ok(fw.maxStage === 1, 'maxStage did not advance, got ' + fw.maxStage);
  ok(fw.coinStyle && fw.coinStyle.index === 0,
    '1980 shares 1972 coin face, got style ' + JSON.stringify(fw.coinStyle));

  const bk = out.steps[3].back;
  ok(bk.row0.dis === false, 'a visited era should be tappable to go back to');
  ok(/back/.test(bk.row0.cls), 'a visited era should be marked as walkable, got ' + bk.row0.cls);
  ok(bk.stageAfter === 0, 'walking back landed on stage ' + bk.stageAfter);
  ok(bk.maxStage === 1, 'walking back lowered maxStage to ' + bk.maxStage);

  const rs = out.steps[4].reset;
  ok(rs.renewOpen === true, 'reset showed no card on the table');
  ok(rs.year === '1972', 'renew card year is ' + rs.year);
  ok(rs.after.stage === 0 && rs.after.coins === 24, 'reset state is ' + JSON.stringify(rs.after));
  ok(rs.after.got === 0, 'reset left ' + rs.after.got + ' collectibles');
  ok(rs.after.maxStage === 0, 'reset left maxStage at ' + rs.after.maxStage);
  ok(rs.after.coinStyle && rs.after.coinStyle.index === 0, 'reset left the coin face on ' + JSON.stringify(rs.after.coinStyle));
  ok(/maxStage":0/.test(rs.after.saved || ''), 'save still carries an old maxStage');
  ok(rs.closed === true, 'renew card did not close');

  const af = out.steps[5].after;
  ok(af.hudInert === false, 'the HUD stayed inert after the cards closed');
  ok(af.erasOpen === false && af.renewOpen === false, 'an overlay was left open');

  if (out.errors.length) fails.push('console errors: ' + out.errors.join(' | '));

  console.log(fails.length ? '\nERA FAIL\n - ' + fails.join('\n - ') : '\nERA OK');
  ws.close();
  proc.kill();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error('ERR', e.message);
  try { proc.kill(); } catch (x) {}
  process.exit(2);
});
