// Two promises that only a play-through can keep:
//   2. a coin that leaves the side of the table must be visibly gone -- it
//      should be a falling object with real velocity, not a pop();
//   3. a collectible that falls off must come back, or the museum becomes
//      impossible to finish and the player has no way to know why.
//
// Run: node tools/offtest.mjs [--secs=180] [--shot=dir]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL = 'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const ROOT = 'C:/Users/osman_lam/Projects/WebGame/Coin Pusher';
const RAW = process.env.GAME_URL || 'file:///' + ROOT.replace(/ /g, '%20') + '/index.html';
const PAGE = /[?&]bot\b/.test(RAW) ? RAW : RAW + (RAW.indexOf('?') < 0 ? '?' : '&') + 'bot';
const PORT = 9680 + Math.floor(Math.random() * 40);

const argNum = (name, dflt) => {
  const a = process.argv.find((v) => v.startsWith('--' + name + '='));
  if (!a) return dflt;
  const v = Number(a.slice(name.length + 3));
  if (!isFinite(v)) { console.error('bad --' + name); process.exit(2); }
  return v;
};
const SECS = argNum('secs', 180);
const shotArg = process.argv.find((a) => a.startsWith('--shot='));
const SHOT = shotArg ? shotArg.slice(7) : '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(SHELL, ['--headless', '--disable-gpu', '--no-sandbox', '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1280,800',
  'about:blank'], { stdio: 'ignore' });

let ws, id = 0;
const pend = new Map();
const out = { steps: [], errors: [] };

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { await sleep(250); }
  }
  throw new Error('no devtools endpoint');
}

function send(method, params = {}, sessionId) {
  const mid = ++id;
  const msg = { id: mid, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => {
    pend.set(mid, { res, rej });
    setTimeout(() => { if (pend.has(mid)) { pend.delete(mid); rej(new Error('timeout ' + method)); } }, 40000);
  });
}

async function evaluate(expr, session) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, session);
  if (r.exceptionDetails) {
    throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  }
  return r.result ? r.result.value : undefined;
}

async function shot(session, path) {
  const c = await send('Page.captureScreenshot', { format: 'png' }, session);
  writeFileSync(path, Buffer.from(c.data, 'base64'));
}

async function main() {
  const url = await connect();
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
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

  for (let i = 0; i < 15; i++) {
    const ok = await evaluate(`(function(){var b=document.getElementById('sGo');if(!b)return false;b.click();return !!(window.__bot&&window.__bot.state&&window.__bot.state.started);})()`, sessionId);
    if (ok) break;
    await sleep(400);
  }

  // ── 2. a coin that goes over the side must actually fall ───────────────
  // Force the situation: put a coin against the rail at the back, shove it
  // sideways, and watch what the simulation does with it.
  const spill = await evaluate(`(function(){
    var s = window.Sim;
    var t = s.DECK.table;
    // one coin parked just inside the left rail, behind the gutters so the
    // rail still catches it, then kicked hard towards the rail
    var zOpen = s.DECK.gutterZ + 0.10;
    var c = s.spawn(t.x0 + 0.06, zOpen, 'coin');
    c.vx = -2.4; c.vz = 0.15;
    var trail = [];
    var before = { lost: s.stats.lost, fall: s.fall.length };
    for (var i = 0; i < 110; i++) {
      s.step(s.STEP);
      if (i % 10 === 0) {
        trail.push({ i: i, x: +(c.x||0).toFixed(4), z: +(c.z||0).toFixed(4),
                     st: c.state, spill: !!c.spill });
      }
    }
    s.stepFall(1/60);
    var f = null;
    for (var k = 0; k < s.fall.length; k++) if (s.fall[k].id === c.id) f = s.fall[k];
    return {
      before: before,
      trail: trail,
      gone: s.coins.indexOf(c) < 0,
      lostDelta: s.stats.lost - before.lost,
      inFall: !!f,
      fallShape: f ? { st: f.state, spill: !!f.spill, fx: +(+f.fx).toFixed(4), fz: +(+f.fz).toFixed(4),
                       fvx: +(+f.fvx).toFixed(3), fvy: +(+f.fvy).toFixed(3), fvz: +(+f.fvz).toFixed(3),
                       vx: +(+f.vx).toFixed(3) } : null
    };
  })()`, sessionId);
  out.steps.push({ spill: spill });

  // Where do the spilt coins actually LAND on screen? A coin that falls out of
  // frame is indistinguishable from a coin that was deleted.
  const landing = await evaluate(`(function(){
    var s = window.Sim, t = s.DECK.table;
    s.coins.length = 0; s.fall.length = 0;
    for (var i = 0; i < 8; i++) {
      var c = s.spawn(t.x0 + 0.05 + i * 0.005, s.DECK.gutterZ + 0.06 + i * 0.02, 'coin');
      c.vx = -2.2 - i * 0.15; c.vz = 0.2;
      for (var k = 0; k < 130; k++) s.step(s.STEP);
    }
    for (var j = 0; j < 60; j++) s.stepFall(1 / 60);
    var pts = s.fall.map(function (f) {
      var v = new THREE.Vector3(f.fx, f.fy, f.fz); v.project(R.camera);
      return { x: +v.x.toFixed(2), y: +v.y.toFixed(2),
               on: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
               fx: +(+f.fx).toFixed(2), fz: +(+f.fz).toFixed(2) };
    });
    return JSON.stringify({ n: pts.length, pts: pts,
      onScreen: pts.filter(function (p) { return p.on; }).length });
  })()`, sessionId).then(JSON.parse);
  out.steps.push({ landing: landing });

  // ── 3. a collectible over the side must be queued to come back ─────────
  const respawn = await evaluate(`(function(){
    var s = window.Sim;
    var st = CONTENT.STAGES[window.__bot.state.stageIdx];
    var id = st.big[0];
    // clear whatever is on the table so the probe owns the situation
    s.coins.length = 0; s.fall.length = 0;
    window.__bot.state.respawn = [];
    window.__bot.state.won = {};
    var t = s.DECK.table;
    var zOpen2 = s.DECK.gutterZ + 0.10;
    var c = s.spawn(t.x0 + 0.06, zOpen2, 'prop', id);
    var before = { lost: s.stats.lost, respawn: window.__bot.state.respawn.length };
    c.vx = -2.6; c.vz = 0.15;
    for (var i = 0; i < 130; i++) s.step(s.STEP);
    var afterScrap = { lost: s.stats.lost, respawn: window.__bot.state.respawn.slice(),
                       gone: s.coins.indexOf(c) < 0, won: !!window.__bot.state.won[id] };
    // the lost callback schedules the respawn; give it its 2.2 s
    return JSON.stringify({ id: id, before: before, afterScrap: afterScrap });
  })()`, sessionId).then(JSON.parse);
  out.steps.push({ respawn: respawn });

  await sleep(3200);
  const respawnLanded = await evaluate(`(function(){
    var s = window.Sim;
    var id = ${JSON.stringify(respawn.id)};
    var st = CONTENT.STAGES[window.__bot.state.stageIdx];
    var onTable = 0;
    for (var i = 0; i < s.coins.length; i++) if (s.coins[i].prop === id) onTable++;
    return JSON.stringify({
      queue: window.__bot.state.respawn.slice(),
      onTable: onTable,
      stillUncollected: !UI.state.collected[id],
      big: st.big.indexOf(id) >= 0
    });
  })()`, sessionId).then(JSON.parse);
  out.steps.push({ respawnLanded: respawnLanded });

  // ── and a played-out run must still show coins leaving the table ────────
  const run = await evaluate(`(function(){
    var s = window.Sim;
    var n0 = { lost: s.stats.lost, paid: s.stats.paid };
    var peakSpill = 0, peakFloorCoins = 0, peakAny = 0, journeys = 0;
    var seenIds = {};
    var steps = Math.round(${SECS} / s.STEP);
    var nextDrop = 0;
    for (var i = 0; i < steps; i++) {
      // feed at a human rate: one coin every 1.1 s
      if (s.t >= nextDrop) { window.__bot.dropAt(0.42); nextDrop = s.t + 1.1; }
      s.step(s.STEP);
      if (i % 4 === 0) s.stepFall(4 * s.STEP);
      if (i % 12 === 0) {
        var sp = 0, fc = 0;
        for (var k = 0; k < s.fall.length; k++) {
          var f = s.fall[k];
          if (!seenIds[f.id]) { seenIds[f.id] = 1; journeys++; }
          if (f.spill) sp++;
          if (f.kind === 'coin') fc++;
        }
        if (sp > peakSpill) peakSpill = sp;
        if (fc > peakFloorCoins) peakFloorCoins = fc;
        if (s.fall.length > peakAny) peakAny = s.fall.length;
      }
    }
    return JSON.stringify({
      t: +s.t.toFixed(1),
      lost: s.stats.lost - n0.lost,
      paid: s.stats.paid - n0.paid,
      peakSpill: peakSpill,
      peakFloorCoins: peakFloorCoins,
      peakOnFloor: peakAny,
      fallJourneys: journeys
    });
  })()`, sessionId).then(JSON.parse);
  out.steps.push({ run: run });

  if (SHOT) {
    try { mkdirSync(SHOT, { recursive: true }); } catch (e) {}
    // park a few spilt coins on the floor so the shot has something to show
    await evaluate(`(function(){
      var s = window.Sim, t = s.DECK.table;
      for (var i = 0; i < 7; i++) {
        var c = s.spawn(t.x0 + 0.04 + i * 0.01, -0.06, 'coin');
        c.vx = -2.6 - i * 0.15; c.vz = 0.5;
        for (var k = 0; k < 90; k++) s.step(s.STEP);
      }
      for (var j = 0; j < 400; j++) s.stepFall(1 / 60);
      return 1;
    })()`, sessionId);
    await sleep(900);
    await shot(sessionId, join(SHOT, 'spill.png'));
  }

  console.log(JSON.stringify(out, null, 1));

  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const sp = out.steps[0].spill;
  ok(sp.gone === true, 'the coin never left the coin list');
  ok(sp.lostDelta === 1, 'scrapping a coin did not count exactly one loss, got ' + sp.lostDelta);
  ok(sp.inFall === true, 'the scrapped coin was not pushed into the fall list');
  ok(!!sp.fallShape, 'no fall record for the scrapped coin');
  if (sp.fallShape) {
    ok(sp.fallShape.spill === true, 'a scrapped coin is not marked as spilt');
    ok(sp.fallShape.fvz > 0.2, 'a scrapped coin was not thrown forward, fvz=' + sp.fallShape.fvz);
    ok(sp.fallShape.fvy >= 0, 'a scrapped coin was launched downwards, fvy=' + sp.fallShape.fvy);
    ok(isFinite(sp.fallShape.fx) && isFinite(sp.fallShape.fz),
      'a scrapped coin has no finite fall position: ' + JSON.stringify(sp.fallShape));
  }

  const ld = out.steps[1].landing;
  ok(ld.n > 0, 'no coin was left falling after the spill probe');
  ok(ld.onScreen === ld.n,
    'spilt coins land off screen: ' + ld.onScreen + '/' + ld.n + ' visible ' + JSON.stringify(ld.pts));

  const rs = out.steps[2].respawn;
  ok(rs.afterScrap.gone === true, 'the collectible never left the coin list');
  ok(rs.afterScrap.lost > rs.before.lost, 'losing a collectible was not counted');
  ok(rs.afterScrap.respawn.length === 1, 'a lost collectible was not queued to come back: ' +
    JSON.stringify(rs.afterScrap.respawn));
  ok(rs.afterScrap.won === false, 'an uncollected collectible was marked as won');

  const rl = out.steps[3].respawnLanded;
  ok(rl.onTable >= 1, 'the queued collectible never came back to the table (onTable=' + rl.onTable + ')');
  ok(rl.stillUncollected === true, 'comeback collectible was already marked collected');

  const rn = out.steps[4].run;
  ok(rn.lost > 0, 'aiming at the edge lost no coins in ' + SECS + 's');
  ok(rn.fallJourneys > 0, 'nothing ever fell off the table in ' + SECS + 's of edge play');
  ok(rn.peakOnFloor > 0, 'the floor was never occupied during ' + SECS + 's');
  ok(rn.peakSpill > 0, 'no spilt coin ever showed on the floor');

  if (out.errors.length) fails.push('console errors: ' + out.errors.join(' | '));

  console.log(fails.length ? '\nOFF FAIL\n - ' + fails.join('\n - ') : '\nOFF OK');
  ws.close(); proc.kill();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error('ERR', e.message); try { proc.kill(); } catch (x) {} process.exit(2); });
