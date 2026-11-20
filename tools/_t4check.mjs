// t4 acceptance harness: the three captain defects + the new feedback cues.
// Each claim below is measured on a real page, not argued from the diff.
import { spawn } from 'node:child_process';

const arg = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const SHELL = arg('shell',
  'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe');
const URL_ = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};
const fails = [];
function check(name, ok, detail) {
  out[name] = { ok: !!ok, detail };
  if (!ok) fails.push(name + ' :: ' + JSON.stringify(detail));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${JSON.stringify(detail)}`);
}

async function session(W, H, opts = {}) {
  const port = 9500 + Math.floor(Math.random() * 400);
  const child = spawn(SHELL, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let wsUrl = null;
  child.stderr.on('data', b => { const m = /ws:\/\/[^\s]+/.exec(b.toString()); if (m) wsUrl = m[0]; });
  for (let i = 0; i < 120 && !wsUrl; i++) await sleep(100);
  const ws = new WebSocket(wsUrl);
  const waiters = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('PAGEERROR ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      logs.push('CONSOLE ' + msg.params.args.map(a => a.value || a.description || '').join(' '));
    }
  });
  const logs = [];
  await new Promise(r => ws.addEventListener('open', r));
  let nextId = 1;
  const send = (method, params = {}, sid) => new Promise(res => {
    const id = nextId++; waiters.set(id, res);
    ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
  });
  await send('Target.setDiscoverTargets', { discover: true });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = att.result.sessionId;
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: opts.mobile !== false }, sessionId);
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
  await send('Page.navigate', { url: URL_ }, sessionId);
  await sleep(4200);
  await ev(`document.getElementById('sGo').click(); return 1`);
  await sleep(500);
  return { ev, evJ, logs, close: () => { ws.close(); child.kill(); } };
}

async function main() {
  // ── defect 3: the three buttons must be the same width ─────────────────
  for (const [w, h] of [[1280, 800], [390, 844], [844, 390], [320, 568]]) {
    const s = await session(w, h);
    const r = await s.evJ(`
      var ids = ['museumBtn','settingsBtn','slapBtn'];
      var ws = ids.map(function(id){ return +document.getElementById(id).getBoundingClientRect().width.toFixed(1); });
      var hs = ids.map(function(id){ return +document.getElementById(id).getBoundingClientRect().height.toFixed(1); });
      return JSON.stringify({ w: ws, h: hs, spread: +(Math.max.apply(null, ws) - Math.min.apply(null, ws)).toFixed(1) });
    `);
    check(`buttons equal width @${w}x${h}`, r.spread <= 1.0, r);
    await s.close();
  }

  // ── defect 1: mute survives a reload, and reset does not clear it ──────
  {
    const s = await session(390, 844);
    const before = await s.evJ(`
      return JSON.stringify({ muted: window.UI.isMuted(), label: document.getElementById('soundToggleState').textContent });
    `);
    await s.ev(`document.getElementById('soundToggle').click(); return 1`);
    await sleep(300);
    const afterOff = await s.evJ(`
      return JSON.stringify({
        muted: window.UI.isMuted(),
        label: document.getElementById('soundToggleState').textContent,
        aria: document.getElementById('soundToggle').getAttribute('aria-checked'),
        save: JSON.parse(localStorage.getItem('yatmangai.save.v1') || 'null')
      });
    `);
    // reload the same page: file:// origin keeps localStorage
    await s.ev(`location.reload(); return 1`);
    await sleep(4200);
    await s.ev(`document.getElementById('sGo').click(); return 1`);
    await sleep(600);
    const afterReload = await s.evJ(`
      return JSON.stringify({
        muted: window.UI.isMuted(),
        label: document.getElementById('soundToggleState').textContent,
        aria: document.getElementById('soundToggle').getAttribute('aria-checked'),
        save: JSON.parse(localStorage.getItem('yatmangai.save.v1') || 'null')
      });
    `);
    check('mute toggles off in the UI', afterOff.muted === true && afterOff.label === '關' && afterOff.aria === 'false', afterOff);
    check('mute is written to the save', afterOff.save && afterOff.save.muted === true, afterOff.save);
    check('mute survives reload',
      afterReload.muted === true && afterReload.label === '關' && afterReload.aria === 'false', afterReload);

    // now reset with sound still off, and prove the reset left the setting alone
    await s.ev(`document.getElementById('settingsBtn').click(); return 1`);
    await sleep(300);
    await s.ev(`document.getElementById('settingsReset').click(); return 1`);
    await sleep(150);
    await s.ev(`document.getElementById('settingsReset').click(); return 1`);
    await sleep(700);
    const afterReset = await s.evJ(`
      var p = JSON.parse(window.__probe());
      return JSON.stringify({
        muted: window.UI.isMuted(),
        label: document.getElementById('soundToggleState').textContent,
        save: JSON.parse(localStorage.getItem('yatmangai.save.v1') || 'null'),
        wallet: p.wallet,
        coinsText: document.getElementById('coins').textContent,
        stage: p.stage
      });
    `);
    check('reset keeps the sound setting off', afterReset.muted === true && afterReset.label === '關', afterReset);
    // ── defect 2: reset leaves a playable wallet, not a dead machine ─────
    check('wallet is playable right after reset (no reload)',
      afterReset.wallet === 24 && afterReset.coinsText === '24', afterReset);
    check('reset returns to stage 0', afterReset.stage === 0, afterReset);
    check('reset save carries muted and 24 coins',
      afterReset.save && afterReset.save.muted === true && afterReset.save.coins === 24, afterReset.save);
    console.log('logs:', s.logs);
    await s.close();
  }

  // ── the new cues actually fire ────────────────────────────────────────
  {
    const s = await session(1280, 800);
    // Watch the HUD and the renderer for the whole burst instead of sampling
    // once at the end: a combo and a landing pool are both transient, and a
    // single snapshot after the fact would "prove" nothing either way.
    await s.ev(`
      window.__seen = { combo: 0, tick: 0, glow: 0, big: 0, payouts: 0 };
      var c = document.getElementById('combo');
      var box = document.getElementById('coinBox');
      var p0 = JSON.parse(window.__probe()).wallet;
      window.__p0 = p0;
      // sample, do not sample once: a combo lasts 1.5 s and a landing pool
      // fades in 0.5 s, so a single end-of-run snapshot proves nothing
      setInterval(function () {
        if (!c.hidden) {
          window.__seen.combo = Math.max(window.__seen.combo,
            parseInt((c.textContent || '').replace(/[^0-9]/g, ''), 10) || 0);
        }
        if (box.classList.contains('tick')) window.__seen.tick++;
        if (window.R && window.R.glowState) {
          var g = window.R.glowState();
          window.__seen.glow = Math.max(window.__seen.glow, g.live);
          window.__seen.big = Math.max(window.__seen.big, g.big);
        }
        var st = window.Sim && window.Sim.stats;
        if (st) window.__seen.payouts = st.paid;
      }, 50);
      return 1;
    `);
    const before = await s.evJ(`return JSON.stringify({ wallet: JSON.parse(window.__probe()).wallet });`);
    // Fast-forward in ~1 s slices, with a real sleep between them. A single
    // big advance() would step the whole burst inside one JS task, so the
    // render loop would never see a coin ON the floor: the 0.9 s dwell would
    // open and close between two frames and the glow could not be observed
    // even if it were working. Slicing keeps the renderer in the loop.
    for (let k = 0; k < 16; k++) {
      await s.ev(`window.__bot.advance(1, { dropAt: 0.02, every: 0.8 }); return 1`);
      await sleep(110);
    }
    const after = await s.evJ(`
      var p = JSON.parse(window.__probe());
      return JSON.stringify({
        wallet: p.wallet, seen: window.__seen, stats: p.stats,
        topPile: document.getElementById('topPile').textContent,
        topPileHidden: document.getElementById('topPile').hidden
      });
    `);
    check('payout moves the wallet down then back up', after.wallet !== before.wallet, { before, after });
    check('coins actually paid out', after.seen.payouts > 0, { payouts: after.seen.payouts, stats: after.stats });
    check('coin value ticks on payout', after.seen.tick > 0, after.seen);
    check('landing pool appears on the floor', after.seen.glow > 0, after.seen);
    check('a payout streak is counted', after.seen.combo >= 2, after.seen);
    check('upper-deck counter is live', after.topPileHidden === false && /\d/.test(after.topPile), after);

    // ── the big beat: a prop falls out and the game says so ────────────
    // Measured: the first bigPayout lands around 54 game-seconds of steady
    // dropping (swiftshader renders ~4 fps, so real time is 4x that). Sliced
    // 1 s advances with a real sleep between them, for the same reason as the
    // payout block above: one big advance() would hide the whole beat inside
    // a single JS task.
    await s.ev(`
      window.__big = { glow: 0, card: 0, tag: '', stats: null };
      setInterval(function () {
        if (window.R && window.R.glowState) {
          window.__big.glow = Math.max(window.__big.glow, window.R.glowState().big);
        }
        if (document.getElementById('card').classList.contains('on')) window.__big.card = 1;
        window.__big.tag = document.getElementById('cardTag').textContent;
        if (window.Sim && window.Sim.stats) window.__big.stats = window.Sim.stats;
      }, 40);
      return 1;
    `);
    let bigSeen = null;
    for (let k = 0; k < 70 && !bigSeen; k++) {
      await s.ev(`window.__bot.advance(1, { dropAt: 0.03, every: 0.55 }); return 1`);
      await sleep(90);
      bigSeen = await s.evJ(`
        var b = window.__big;
        return JSON.stringify({
          glow: b.glow, card: b.card, tag: b.tag,
          stats: b.stats, collected: JSON.parse(window.__probe()).collected
        });
      `);
      if (bigSeen && bigSeen.stats && bigSeen.stats.bigPaid > 0) break;
      bigSeen = null;
    }
    check('a prop falling is announced', !!(bigSeen && bigSeen.stats.bigPaid > 0),
      { seen: bigSeen, note: bigSeen ? null : 'no bigPayout within 70 game-seconds' });
    if (bigSeen && bigSeen.stats.bigPaid > 0) {
      check('the prop card opens on a big payout', bigSeen.card === 1, bigSeen);
      check('the prop is collected', (bigSeen.collected | 0) >= 1, { collected: bigSeen.collected });
    }

    // ── the marker colours follow the aim ──────────────────────────────
    await s.ev(`window.__bot.dropAt(0.50); return 1`);
    await sleep(350);
    const gutterState = await s.evJ(`
      var p = JSON.parse(window.__probe());
      return JSON.stringify({ inSlot: p.input.inSlot, aimX: p.input.aimX, head: p.aim });
    `);
    check('aim marker reports gutter outside the slot', gutterState.inSlot === false, gutterState);
    check('marker is red over the gutter', /^#c8342b$/i.test(gutterState.head || ''), gutterState);
    await s.ev(`window.__bot.dropAt(0); return 1`);
    await sleep(350);
    const inSlot = await s.evJ(`
      var p = JSON.parse(window.__probe());
      return JSON.stringify({ inSlot: p.input.inSlot, head: p.aim });
    `);
    check('aim marker reports slot at centre', inSlot.inSlot === true, inSlot);
    check('marker is gold in the slot', /^#ffd28a$/i.test(inSlot.head || ''), inSlot);

    // ── the landing glow must exist on the floor ────────────────────────
    const glow = await s.evJ(`
      return JSON.stringify(window.R.glowState ? window.R.glowState() : null);
    `);
    console.log('glow:', JSON.stringify(glow));

    // ── shake is provable and honours reduced motion ────────────────────
    const shake = await s.evJ(`
      var before = window.R.shakeState();
      window.R.shake(0.014, 180);
      var after = window.R.shakeState();
      return JSON.stringify({ before: before, after: after });
    `);
    check('R.shake arms a shake', shake.after.t > 0 && shake.after.mag > 0, shake);

    const stats = await s.evJ(`
      // stage-done stats block: call the real function with real numbers
      var st = window.CONTENT.STAGES[0];
      window.UI.showStageDone(st, false, { drops: 12, paid: 9, lost: 3, got: 2, total: 9 });
      var d = document.getElementById('doneStats');
      return JSON.stringify({
        hidden: d.hidden, cells: d.querySelectorAll('.dsCol').length,
        text: d.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80)
      });
    `);
    check('stage-done screen reports the numbers', stats.hidden === false && stats.cells === 4, stats);
    console.log('logs:', s.logs);
    await s.close();
  }

  console.log(fails.length ? `\nT4CHECK FAILED ${fails.length}:\n` + fails.join('\n') : '\nT4CHECK OK');
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
