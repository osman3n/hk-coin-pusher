/* 一蚊雞 — main.js
 * Wiring: input, the game loop, prop surfacing, stage progression.
 *
 * `?selftest` runs the assertion suite and prints PASS/FAIL to the console.
 * `?probe` dumps the numeric state that a screenshot can never prove.
 */
(function (G) {
  'use strict';

  var C = G.CONTENT, Sim = G.Sim, R = G.R, UI = G.UI;
  var canvas, app = {}, lastT = 0, acc = 0;
  var PROPS_PER_STAGE = 9;
  // Bumped whenever the surfacing rules change, so a test can tell an old
  // cached copy from a stale read of the source.
  var BUILD = 'gate-3';
  var COINS_PER_PROP = 14;
  // One literal for the starting wallet. The reset used to wipe the wallet and
  // forget to give it back, which left a fresh player staring at a dead machine
  // until 陳伯 topped them up 700 ms later.
  var START_COINS = 24;

  var SELFTEST = /[?&]selftest\b/.test(location.search);
  var PROBE = /[?&]probe\b/.test(location.search);

  // ── input state ────────────────────────────────────────────────────────
  var aim = { x: 0, active: false, dragging: false };
  var pointer = { x: 0, y: 0 };
  var ray = null, plane = null;

  function screenToTable(cx, cy) {
    if (!ray) {
      ray = new G.THREE.Raycaster();
      plane = new G.THREE.Plane(new G.THREE.Vector3(0, 1, 0), -0.05);
    }
    var ndc = new G.THREE.Vector2(
      (cx / app.w) * 2 - 1,
      -(cy / app.h) * 2 + 1
    );
    ray.setFromCamera(ndc, app.camera);
    var hit = new G.THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) return hit;
    return null;
  }

  // ── stage / prop flow ──────────────────────────────────────────────────
  app.state = {
    stageIdx: 0,
    coins: START_COINS,
    paidSinceProp: 0,
    nextPropIdx: 0,
    spent: 0,
    lost: 0,
    drops: 0,
    paid: 0,
    started: false,
    // Prizes waiting to be re-surfaced because they fell off the deck. A prize
    // is never destroyed -- it can be lost, which costs the player the push, but
    // it always comes back, or a bad shove would end the stage's collection.
    respawn: [],
    won: {}
  };

  function stage() { return C.STAGES[app.state.stageIdx]; }

  function applyStage(idx, keepSave) {
    app.state.stageIdx = idx;
    var st = C.STAGES[idx];
    app.state.paidSinceProp = 0;
    app.state.nextPropIdx = 0;
    app.state.respawn = [];
    R.setCabinet(st.palette, idx);
    UI.setStage(st, idx);
    Sim.reset(1000 + idx);
    Sim.onPayout = onPayout;
    Sim.onBigPayout = onBigPayout;
    Sim.onLost = onLost;
    Sim.seedPile(56 + idx * 4);
    // coins are the wallet and survive an era change; only the table is rebuilt
    UI.setCoins(app.state.coins);
    // Walking back to 1972 to re-shove a lost prize must not lock 1980 behind
    // it, so the furthest decade reached is its own number.
    UI.setMaxStage(idx);
    if (!keepSave) UI.say(st.open, 4200);
  }

  // Spawn the next uncollected prop for this stage, from the back of the table.
  // Small props come out first and thickest: they are the pile's filler, and
  // they teach the player that the table pays before the big ones ask for
  // real effort. Big props are interleaved so none sits last as a wall.
  // The three big prizes are the gate for the next decade, so they must not be
  // buried behind six small ones. Interleave big-first: the player meets one
  // within the first two surfaces, and all three are on the deck before the
  // small ones run out.
  function stageOrder(st) {
    var order = [], s = st.small.slice(), b = st.big.slice();
    var i, n = Math.max(s.length, b.length);
    for (i = 0; i < n; i++) {
      if (i < b.length) order.push(b[i]);
      if (i < s.length) order.push(s[i]);
    }
    return order;
  }

  // Is there still a big prize that has never been put on the deck or won?
  // Those three gate the decade, so they outrank a small one coming back.
  function bigStillWaiting(st) {
    var order = app.state.order || [];
    for (var i = 0; i < st.big.length; i++) {
      var id = st.big[i];
      if (UI.state.collected[id] || Sim.hasProp(id)) continue;
      if (order.indexOf(id) >= app.state.nextPropIdx) return true;
    }
    return false;
  }

  function maybeSurfaceProp() {
    var st = stage();
    if (!app.state.order || app.state.orderStage !== st.id) {
      app.state.order = stageOrder(st);
      app.state.orderStage = st.id;
      app.state.nextPropIdx = 0;
    }
    // A prize that fell off comes back before anything new is introduced: the
    // player already saw it and lost it, so making them earn a different one
    // instead would read as the game forgetting what they did. The one
    // exception is the gate -- a small one coming back must not delay a big
    // one that has never appeared, or the decade stalls.
    if (app.state.respawn.length) {
      var gate = bigStillWaiting(st);
      var pick = -1;
      for (var r = 0; r < app.state.respawn.length; r++) {
        var rid = app.state.respawn[r];
        if (!rid || UI.state.collected[rid] || Sim.hasProp(rid)) continue;
        var isBig = st.big.indexOf(rid) >= 0;
        if (!gate || isBig) { pick = r; break; }
      }
      if (pick >= 0) {
        var back = app.state.respawn.splice(pick, 1)[0];
        return surfaceProp(back, st);
      }
      // Everything queued is a small prize and the gate is still closed: fall
      // through and let the order put a big one out.
    }
    var order = app.state.order;
    while (app.state.nextPropIdx < order.length) {
      var id = order[app.state.nextPropIdx++];
      if (UI.state.collected[id]) continue;
      if (Sim.hasProp(id)) continue;
      return surfaceProp(id, st);
    }
    return null;
  }

  // Put one prize on the deck. Shared by first-time surfacing and by the
  // respawn queue, so a returned prize arrives exactly the way it first did.
  function surfaceProp(id, st) {
    // Prizes surface near the back of the one deck, so they have the whole
    // table to be shoved across before they reach the payout slot.
    //
    // They surface from the chute at the back centre, and tightly so. Past
    // `front + r` a prize can only be moved by the weight of coins behind it;
    // the coin bed thins out toward the rails, so a prize that appears near
    // |x|=0.5 can never be shifted again and blocks the whole decade. Measured
    // over all 21 big prizes: |x|<=0.30 pays 73% (17 stalls), <=0.16 pays 95%,
    // <=0.10 pays 100%. A stall is unrecoverable, so the band has to be the
    // one that never stalls.
    var T = Sim.DECK.table, by = Sim.DECK.y;
    var band = 0.10;
    var x = (Math.random() * 2 - 1) * band;
    var z = T.z0 + 0.10 + Math.random() * 0.10;
    var c = Sim.spawn(x, z, 'prop', id);
    c.fallT = 0.38; c.cy = by + 0.26;
    var isBig = st.big.indexOf(id) >= 0;
    if (isBig) { UI.say(pick(C.MACHINE.bigFall)); }
    return c;
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function onPayout(coin) {
    app.state.coins++;
    app.state.paid++;
    UI.tick(app.state.coins);
    UI.clink();
    UI.coinPaid();
    app.state.paidSinceProp++;
    if (app.state.paidSinceProp >= COINS_PER_PROP) {
      app.state.paidSinceProp = 0;
      setTimeout(maybeSurfaceProp, 120);
    }
  }

  // A coin that crossed outside the payout slot is machine scrap. Say so, or
  // the player just sees coins vanish and assumes the game is broken.
  function onLost(coin) {
    app.state.lost++;
    UI.tick(app.state.coins);
    // A prize that leaves the table always comes back. It is not a coin: the
    // player spent minutes shoving it, and deleting it on a bad bounce would
    // make the collection unwinnable through no fault of theirs.
    if (coin.kind === 'prop' && coin.prop && !app.state.won[coin.prop]) {
      if (app.state.respawn.indexOf(coin.prop) < 0) app.state.respawn.push(coin.prop);
      UI.say('跌咗件嘢落機底……等陣再推出嚟。', 2600);
      // Do not make the comeback depend on the player paying 14 more coins: a
      // prize lost at the end of a stage would never return.
      setTimeout(function () { maybeSurfaceProp(); }, 2200);
    } else if (app.state.lost % 2 === 1) {
      UI.say(pick(C.MACHINE.lost), 1800);
    }
  }

  function onBigPayout(coin) {
    var id = coin.prop;
    app.state.won[id] = true;
    app.state.coins += 3;
    UI.tick(app.state.coins);
    UI.rumble();
    Sim.busy = true;
    UI.showCard(id, function () {
      Sim.busy = false;
      UI.save();
      if (UI.bigComplete(stage())) {
        setTimeout(function () {
          var isLast = app.state.stageIdx >= C.STAGES.length - 1;
          Sim.busy = true;
          UI.showStageDone(stage(), isLast, stageStats());
        }, 620);
      } else {
        UI.say(pick(C.MACHINE.win), 2200);
      }
    });
  }

  // What the decade cost, in the numbers the player already watched happen.
  // Drops and losses are this session's; paid is the sim's own count, which is
  // the only place a payout is authoritative.
  function stageStats() {
    var st = stage();
    var got = 0, all = (st.big || []).concat(st.small || []);
    all.forEach(function (id) { if (UI.state.collected[id]) got++; });
    return {
      drops: app.state.drops,
      paid: (Sim.stats && Sim.stats.paid) || 0,
      lost: app.state.lost,
      got: got,
      total: all.length
    };
  }

  UI.onNextStage = function () {
    if (app.state.stageIdx >= C.STAGES.length - 1) {
      UI.say('冇下一個年代。得返樓梯底。', 6000);
      Sim.busy = false;
      return;
    }
    Sim.busy = false;
    // applyStage() owns stageIdx, the cabinet and the coin face; bumping the
    // index here as well made the two disagree after a reset.
    applyStage(app.state.stageIdx + 1);
    UI.save();
  };

  // 年代 picker (the year on the HUD). Same door as 翻新部機, reachable any
  // time -- including mid-stage, which is the point: 再推多陣 is a choice, not
  // a life sentence.
  UI.onGoStage = function (idx) {
    if (!(idx >= 0 && idx < C.STAGES.length)) return;
    if (idx === app.state.stageIdx) return;
    // Going forward needs the decade you are standing in cleared; going back is
    // always free. The list already greys out the rest, but the click reaches
    // here through a button, so the rule is checked again where it matters.
    var cur = app.state.stageIdx;
    if (idx > cur && !UI.bigComplete(stage())) {
      UI.say('收齊呢個年代三件大件，部機先會搬。', 3200);
      return;
    }
    Sim.busy = false;
    app.state.stageIdx = idx;
    applyStage(idx, true);
    UI.save();
    UI.say(C.STAGES[idx].open, 3600);
  };

  // 再推多陣: same stage, and the world has to start again. The done card froze
  // it (see onBigPayout), so staying used to leave the table unplayable.
  UI.onStayStage = function () {
    Sim.busy = false;
  };

  // ── reset ──────────────────────────────────────────────────────────────
  // Settings → 重置進度. A reload would be a lie: boot() calls UI.load() and
  // reads the old save straight back in, so the save itself has to go first
  // and everything else has to be re-seeded from zero in place.
  function resetProgress() {
    // 1. the save is the only thing that survives; drop it before anything
    //    else so a crash mid-reset cannot resurrect the old run.
    try { localStorage.removeItem('yatmangai.save.v1'); } catch (e) {}

    // 2. UI-owned progress: collection, seen story beats, stage chrome.
    var S = UI.state;
    S.collected = {};
    S.found = [];
    S.storySeen = {};
    S.cardOpen = false;
    S.onCardClose = null;
    S.mdOpen = false;
    S.mdId = null;
    S.storyTab = false;
    S.stageIdx = 0;
    S.coins = START_COINS;
    // The furthest decade reached is progress too: leaving it at 6 would let a
    // reset player tap the year and walk straight into 2026 with an empty
    // cabinet, which is the opposite of starting over.
    S.maxStage = 0;

    // 3. game state. Nothing of the old run may leak into the new one.
    app.state.stageIdx = 0;
    // The machine is not dead after a reset: the same opening grant as a first
    // boot, from the same constant, so a reset player can drop immediately
    // instead of tapping a dead chute and waiting on 陳伯.
    app.state.coins = START_COINS;
    app.state.paidSinceProp = 0;
    app.state.nextPropIdx = 0;
    app.state.spent = 0;
    app.state.lost = 0;
    app.state.drops = 0;
    app.state.paid = 0;
    // the surface order is cached per stage id; a stale order would keep
    // serving stage-4 props on a 1972 table.
    app.state.order = null;
    app.state.orderStage = null;
    app.state.respawn = [];
    app.state.won = {};

    // 4. hand the table back: the done card may have frozen it, and the reset
    //    button is reachable while a card is up.
    Sim.busy = false;
    acc = 0;
    slapBudget = SLAP_MAX;
    slapCharge = 0;
    publishSlap(true);

    // 5. rebuild the world at 1972 and repaint the chrome from the new numbers.
    applyStage(0, true);
    UI.setCoins(START_COINS);
    UI.setBigCount(C.STAGES[0]);
    if (UI.paintSettings) UI.paintSettings();
    var done = document.getElementById('done');
    if (done) done.classList.remove('on');
    // a card left open would describe a prize that no longer exists. Close it
    // by hand instead of UI.closeCard(), whose callback would save the old run
    // and could pop the stage-done screen for a stage we just left behind.
    var card = document.getElementById('card');
    if (card) card.classList.remove('on');

    // 6. write the fresh save last, so what is on disk matches what is on screen.
    UI.save();

    // 7. and say it out loud. The settings sheet is a small panel behind the
    //    table; a one-line hint inside it was invisible from the machine, so
    //    the player pressed 重置進度, looked up, saw the same coins and the
    //    same 0/9, and concluded the button did nothing.
    var fresh = C.STAGES[0];
    UI.showRenew({
      year: fresh.year,
      stages: 1,
      got: 0,
      coins: START_COINS,
      msg: '櫃清空咗，年代返到第一間舖。之前搵到嘅嘢冇喺度喇。'
    });
  }
  UI.onReset = function () { resetProgress(); };

  // ── loop ───────────────────────────────────────────────────────────────
  function frame(now) {
    var rawDt = (now - lastT) / 1000 || 0.016;
    // The step loop needs a small, stable dt for physics; the slap recharge is
    // a wall-clock cooldown and must keep its 4.2 s feel even at 4 fps, so it
    // reads the unclamped delta (a backgrounded tab simply finishes it).
    if (!(rawDt > 0) || rawDt > 60) rawDt = 0.016;
    var dt = Math.min(0.05, rawDt);
    lastT = now;

    if (app.state.started) {
      acc += dt;
      var guard = 0;
      while (acc >= Sim.STEP && guard++ < 6) {
        Sim.step(Sim.STEP);
        acc -= Sim.STEP;
      }
      Sim.stepFall(dt);
    }

    // The recharge runs on wall time: a collect card holds the world still,
    // but the player should still get their strength back.
    stepSlap(rawDt);

    R.sync(Sim, dt);
    R.render();
    requestAnimationFrame(frame);
  }

  // ── slap ───────────────────────────────────────────────────────────────
  // Three charges, each one recharging on its own 4.2 s clock -- the budget is
  // not dumped back all at once, so an empty button refills visibly. main.js
  // owns the numbers; ui.js only draws them and already throttles its own DOM
  // writes, so republishing every frame while short is cheap and never flickers.
  var SLAP_MAX = 3;
  var SLAP_COOLDOWN = 4.2;        // seconds to win back one charge
  var slapBudget = SLAP_MAX;
  var slapCharge = 0;             // 0..1 progress toward the next charge
  var slapShown = '';             // last published key, so a full meter is quiet

  function slapRatio() {
    if (slapBudget >= SLAP_MAX) return 0;
    return Math.max(0, Math.min(1, slapCharge));
  }

  // Publish on any change, and unconditionally (once per frame) while short so
  // the refill bar can actually move. force is for the moment of use.
  function publishSlap(force) {
    if (!UI.slapState) return;
    var left = Math.max(0, Math.min(SLAP_MAX, slapBudget));
    var ratio = slapRatio();
    var key = left + ':' + (left > 0 ? '-' : ratio.toFixed(3));
    if (!force && left >= SLAP_MAX && key === slapShown) return;
    slapShown = key;
    UI.slapState({ left: left, max: SLAP_MAX, ratio: ratio });
  }

  // Advance the recharge by the same clock the frame loop uses. A charge is
  // promoted the instant its own timer completes; surplus progress carries on
  // toward the next one instead of being thrown away.
  function stepSlap(dt) {
    if (!(dt > 0)) return;
    if (slapBudget < SLAP_MAX) {
      slapCharge += dt / SLAP_COOLDOWN;
      while (slapCharge >= 1 && slapBudget < SLAP_MAX) {
        slapCharge -= 1;
        slapBudget++;
      }
      if (slapBudget >= SLAP_MAX) slapCharge = 0;
    } else {
      slapCharge = 0;
    }
    publishSlap(false);
  }

  UI.onSlap = function () {
    if (Sim.busy) return;
    if (slapBudget <= 0) {
      UI.say('冇力喇。', 1800);
      publishSlap(true);
      return;
    }
    slapBudget--;
    if (UI.slapFired) UI.slapFired();
    publishSlap(true);
    UI.say(pick(C.MACHINE.slap), 2200);
    UI.rumble();
    // the whole machine should take the hit, not just the sound
    if (R.shake) R.shake(0.014, 180);
    // jolt every coin a little toward the lip
    for (var i = 0; i < Sim.coins.length; i++) {
      var c = Sim.coins[i];
      if (c.fallT > 0) continue;
      c.vz += 0.10 + Math.random() * 0.06;
      c.vx += (Math.random() - 0.5) * 0.05;
      c.ax += (Math.random() - 0.5) * 0.3;
    }
  };

  // ── bootstrap ──────────────────────────────────────────────────────────
  function boot() {
    if (!window.THREE) { document.getElementById('err').classList.add('on'); return; }

    canvas = document.getElementById('c');
    R.init(canvas);
    app.w = innerWidth; app.h = innerHeight;
    R.resize(app.w, app.h);
    app.camera = R.camera;          // getter exposed by render.js

    UI.init();

    Sim.onPayout = onPayout;
    Sim.onBigPayout = onBigPayout;

    var loaded = UI.load();
    // The mute flag came back with the save; paint the switch now so the page
    // never shows 開 for a frame over a save that says otherwise.
    if (UI.paintSettings) UI.paintSettings();
    if (loaded) app.state.coins = UI.state.coins || 0;
    if (!loaded || app.state.coins <= 0) app.state.coins = START_COINS;
    applyStage(loaded ? UI.state.stageIdx : 0, loaded);

    wireInput();

    // ── viewport ─────────────────────────────────────────────────────────
    // Three different events matter on a phone and only one of them fires on
    // desktop: resize (orientation change), visualViewport resize (the URL bar
    // sliding away), and orientationchange. Debounced into one relayout so a
    // rotating phone does not rebuild the projection three times mid-animation.
    var relayoutTimer = 0;
    function viewportSize() {
      // visualViewport is the truthful height while the URL bar animates; the
      // canvas is fixed so the layout viewport is the right box to fill.
      return { w: Math.round(innerWidth), h: Math.round(innerHeight) };
    }
    function relayout() {
      var v = viewportSize();
      if (v.w < 1 || v.h < 1) return;
      if (v.w === app.w && v.h === app.h) return;
      app.w = v.w; app.h = v.h;
      R.resize(app.w, app.h);
      app.camera = R.camera;
    }
    function scheduleRelayout(ms) {
      clearTimeout(relayoutTimer);
      relayoutTimer = setTimeout(relayout, ms == null ? 90 : ms);
    }
    addEventListener('resize', function () { scheduleRelayout(0); });
    addEventListener('orientationchange', function () { scheduleRelayout(220); });
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', function () { scheduleRelayout(120); });
    }

    UI.onStart = function () {
      app.state.started = true;
      UI.setStage(stage(), app.state.stageIdx);
      UI.say(pick(C.MACHINE.byStage[stage().id]) || pick(C.MACHINE.idle), 4200);
      setTimeout(function () { UI.say(pick(C.MACHINE.idle), 3600); }, 5200);
      UI.hideHint();
    };

    lastT = performance.now();
    requestAnimationFrame(frame);

    if (SELFTEST) runSelftest();
    // Always expose the probe: it is the only way to prove the game is running
    // from a headless browser, where a screenshot can be a black frame.
    window.__probe = probe;
    // ui.js paints a placeholder budget until main.js reports in; make the real
    // numbers the first thing the button ever shows.
    publishSlap(true);
  }

  // ── input ──────────────────────────────────────────────────────────────
  // Tap-versus-drag matters here. On a desktop, press-move-release over the
  // table reads naturally as "aim, then drop". On a phone the same gesture is
  // how you scroll, and a stray 2 px wobble would silently fire a coin. So a
  // gesture that stays within a fingertip is treated as a tap on release, and
  // a gesture that travels is treated as aiming with an explicit second tap
  // to commit -- except on mouse, where the original press-drag-release stands.
  var TAP_SLOP = 14;          // px of travel still counted as a tap
  // A hold is a finger that is NOT moving. That needs a much tighter bar than
  // tap detection does: a thumb resting still wanders a pixel or three, but a
  // drag crosses this in the first frame, long before HOLD_DELAY could fire.
  // Sharing TAP_SLOP here was a real bug -- a slow drag crept along under 14 px
  // per step and fed coins until it finally tripped the slop.
  var HOLD_SLOP = 6;          // px of travel that disqualifies a hold
  // Hold to feed. A tap is one coin; pressing and keeping the finger down
  // streams them, which is how you actually play a pusher once the deck is
  // loaded and you are trying to start an avalanche. The delay is long enough
  // that a tap can never be mistaken for a hold, and short enough that holding
  // does not feel like a wait.
  var HOLD_DELAY = 240;       // ms of stillness before the stream starts
  var HOLD_REPEAT = 230;      // ms between coins once it has started
  var holdTimer = null, holdRepeat = null;
  var gesture = { id: null, x0: 0, y0: 0, moved: 0, mouse: false, auto: false, dragged: false };

  function wireInput() {
    function down(x, y, mouse) {
      if (Sim.busy) return;
      pointer.x = x; pointer.y = y;
      gesture.x0 = x; gesture.y0 = y; gesture.moved = 0; gesture.mouse = !!mouse;
      gesture.auto = false;
      gesture.dragged = false;
      aim.dragging = true;
      updateAim(x, y);
      stopHold();
      holdTimer = setTimeout(startHold, HOLD_DELAY);
    }
    function move(x, y) {
      pointer.x = x; pointer.y = y;
      if (!aim.dragging) { updateAim(x, y); return; }
      gesture.moved = Math.max(gesture.moved, Math.hypot(x - gesture.x0, y - gesture.y0));
      // dragging is aiming, not feeding: once it is a drag it can never turn
      // into a hold, however long the finger then rests
      if (gesture.moved > HOLD_SLOP) {
        if (!gesture.auto) { gesture.dragged = true; stopHold(); }
        else if (gesture.moved > TAP_SLOP) { gesture.dragged = true; stopHold(); }
      }
      updateAim(x, y);
    }
    function stopHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (holdRepeat) { clearInterval(holdRepeat); holdRepeat = null; }
    }
    // The stream stops itself the moment the machine cannot take another coin,
    // so a player who holds on an empty wallet does not get a queue of drops
    // landing after the top-up.
    function stream() {
      // A prize card freezes the world. If the player is still holding when one
      // opens, the stream has to die here rather than resume by itself when the
      // card closes: coins landing under a card the player is reading is worse
      // than making them press again.
      if (gesture.dragged) { stopHold(); gesture.auto = false; return; }
      if (Sim.busy || !app.state.started) { stopHold(); gesture.auto = false; return; }
      if (app.state.coins <= 0) { stopHold(); gesture.auto = false; return; }
      drop();
    }
    function startHold() {
      holdTimer = null;
      if (!app.state.started || Sim.busy) return;
      if (gesture.dragged || gesture.moved > HOLD_SLOP) return;  // it became a drag
      // the first coin of a hold is immediate: the wait already happened
      gesture.auto = true;
      drop();
      holdRepeat = setInterval(stream, HOLD_REPEAT);
    }
    function up(x, y) {
      if (!aim.dragging) return;
      aim.dragging = false;
      var wasAuto = gesture.auto;
      stopHold();
      gesture.auto = false;
      gesture.dragged = false;
      if (Sim.busy) return;
      updateAim(x, y);
      // A touch that barely moved is a tap and drops; a touch that dragged is
      // left as a positioned aim, and the player taps again to commit. A mouse
      // drag always drops, because dragging is not how it scrolls anything.
      // A hold has already been dropping, so releasing it adds nothing: one
      // gesture must never pay out two coins.
      if (wasAuto) return;
      if (gesture.mouse || gesture.moved <= TAP_SLOP) drop();
    }
    function updateAim(x, y) {
      var hit = screenToTable(x, y);
      if (!hit) return;
      var T = Sim.TABLE;
      var nx = Sim.clamp(hit.x, T.x0 + 0.05, T.x1 - 0.05);
      aim.x += (nx - aim.x) * 0.55;
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (gesture.id !== null && gesture.id !== e.pointerId) return;  // ignore 2nd finger
      gesture.id = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (e2) {}
      down(e.clientX, e.clientY, e.pointerType === 'mouse');
    });
    canvas.addEventListener('pointermove', function (e) {
      move(e.clientX, e.clientY);
    });
    function release(e) {
      if (gesture.id !== null && e.pointerId !== gesture.id) return;
      gesture.id = null;
      up(e.clientX, e.clientY);
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', function (e) {
      gesture.id = null;
      aim.dragging = false;
      gesture.auto = false;
      stopHold();
    });
    // A context menu on a long press eats the gesture on Android.
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // Belt and braces for browsers that still emit the legacy mouse events and
    // would otherwise fire a second drop for the same physical touch.
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { aim.x = Sim.clamp(aim.x - 0.04, -0.5, 0.5); e.preventDefault(); }
      if (e.key === 'ArrowRight') { aim.x = Sim.clamp(aim.x + 0.04, -0.5, 0.5); e.preventDefault(); }
      if (e.key === ' ' || e.key === 'Enter') { drop(); e.preventDefault(); }
      if (e.key === 's' || e.key === 'S') UI.onSlap();
    });
  }

  function drop() {
    if (Sim.busy) return;
    if (!app.state.started) return;
    if (app.state.coins <= 0) {
      // Out of credit. The machine is honest about it and then helps, because
      // a 0.90 return rate means a dead end if nothing ever tops you up.
      UI.say(pick(C.MACHINE.empty), 2400);
      topUp();
      return;
    }
    app.state.coins--;
    app.state.drops++;
    UI.tick(app.state.coins);
    var c = Sim.drop(aim.x);
    c.ax = (Math.random() - 0.5) * 0.5;
  }

  // A broke player gets coins back, on a short cooldown so it cannot be farmed.
  var lastTopUp = 0;
  function topUp() {
    var now = performance.now();
    if (now - lastTopUp < 2500) return;
    lastTopUp = now;
    setTimeout(function () {
      app.state.coins += 8;
      UI.tick(app.state.coins);
      UI.say('陳伯擺低幾蚊。唔好話我知。', 3600);
      UI.chime();
      UI.save();
    }, 700);
  }

  // ── selftest ───────────────────────────────────────────────────────────
  function runSelftest() {
    var pass = 0, fail = 0, msgs = [];
    function ok(name, cond, extra) {
      if (cond) { pass++; console.log('PASS ' + name + (extra ? ' — ' + extra : '')); }
      else { fail++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); msgs.push(name); }
    }

    // 1. the sweep pushes a coin that is in front of it
    //    A full plate period is 2.6 s = 312 steps, so run one and a bit.
    var s = Sim.create();
    s.reset(7);
    s.seedPile(0);
    var c1 = s.spawn(0, -0.15, 'coin');
    c1.fallT = 0;
    var z0 = c1.z;
    for (var i = 0; i < 340; i++) s.step(Sim.STEP);
    ok('plate pushes a coin in front of it', c1.z - z0 > 0.02, 'dz=' + (c1.z - z0).toFixed(4));

    // 2. the bar pushes but never drags: a coin sitting on the felt ahead of
    // the rib must not be pulled backwards on the return stroke.
    var s2 = Sim.create(); s2.reset(8); s2.seedPile(0);
    var c2 = s2.spawn(0, Sim.TABLE.lip - 0.10, 'coin');
    c2.fallT = 0; var z2 = c2.z, minZ = c2.z;
    for (var j = 0; j < 340; j++) {
      s2.step(Sim.STEP);
      if (c2.state === 'on') minZ = Math.min(minZ, c2.z);
    }
    ok('bar never drags a coin backwards', minZ >= z2 - 0.02,
      'dz=' + (minZ - z2).toFixed(4));

    // 3. everything past the lip is paid exactly once
    var s3 = Sim.create(); s3.reset(9); s3.seedPile(0);
    var paid = 0; s3.onPayout = function () { paid++; };
    var c3 = s3.spawn(0, Sim.TABLE.lip + Sim.COIN_R + 0.01, 'coin');
    c3.fallT = 0;
    for (var k = 0; k < 30; k++) s3.step(Sim.STEP);
    ok('payout paid exactly once', paid === 1, 'paid=' + paid);
    ok('paid coin left the table', s3.coins.length === 0, 'n=' + s3.coins.length);

    // 4. layers are monotone and bounded
    var s4 = Sim.create(); s4.reset(10); s4.seedPile(200);
    var maxL = 0, okLayers = true;
    for (var m = 0; m < s4.coins.length; m++) {
      if (s4.coins[m].l > maxL) maxL = s4.coins[m].l;
      if (!isFinite(s4.coins[m].l) || s4.coins[m].l < 0) okLayers = false;
    }
    ok('layers finite and non-negative', okLayers);
    ok('layers within cap', maxL <= Sim.MAX_LAYER, 'max=' + maxL);

    // 5. props are heavier than coins and have a radius
    var allProps = true, bigIds = {}, smallIds = {};
    C.STAGES.forEach(function (st) {
      if (st.big.length !== 3) fail++, msgs.push('stage ' + st.year + ' big count');
      if (st.small.length !== 6) fail++, msgs.push('stage ' + st.year + ' small count');
      st.big.forEach(function (id) { bigIds[id] = 1; });
      st.small.forEach(function (id) { smallIds[id] = 1; });
      var ids = st.big.concat(st.small);
      ids.forEach(function (id) {
        var d = C.PROPS[id];
        if (!d || !d.name || !d.jyut || !d.mem || !(d.weight > 1)) allProps = false;
        if (!R.PROP_BUILD[id]) { allProps = false; console.log('MISSING BUILDER ' + id); }
      });
    });
    ok('every prop has data and a builder', allProps);

    // 6. every page-level prop is accounted for exactly once
    var stageCount = 0;
    C.STAGES.forEach(function (st) { stageCount += st.big.length + st.small.length; });
    ok('stages total 63 items', stageCount === 63, 'n=' + stageCount);
    ok('3 big per stage', Object.keys(bigIds).length === 21, 'n=' + Object.keys(bigIds).length);

    // 7. owners exist in PEOPLE
    var ownersOk = true;
    Object.keys(C.PROPS).forEach(function (id) {
      var d = C.PROPS[id];
      if (d.owner && !C.PEOPLE[d.owner]) { ownersOk = false; console.log('BAD OWNER ' + id); }
    });
    ok('every owner exists', ownersOk);

    // 8. save round-trip
    var saveOk = false;
    try {
      var payload = JSON.stringify({ v: 1, stageIdx: 2, coins: 41, collected: { sodaCase: true } });
      localStorage.setItem('__t', payload);
      var back = JSON.parse(localStorage.getItem('__t'));
      saveOk = back.stageIdx === 2 && back.collected.sodaCase === true;
      localStorage.removeItem('__t');
    } catch (e) { saveOk = false; }
    ok('save round-trips', saveOk);

    // 9. no absolute paths in the document
    var abs = document.querySelectorAll('[src^="/"],[href^="/"]');
    ok('no absolute paths', abs.length === 0, 'n=' + abs.length);

    // 10. performance: 300 coins, 120 steps
    var s5 = Sim.create(); s5.reset(11); s5.seedPile(300);
    var t0 = performance.now();
    for (var n = 0; n < 120; n++) s5.step(Sim.STEP);
    var ms = performance.now() - t0;
    ok('300 coins: 120 steps under 400ms', ms < 400, ms.toFixed(0) + 'ms');

    console.log('SELFTEST ' + (fail === 0 ? 'OK' : 'FAILED') + ' pass=' + pass + ' fail=' + fail);
    if (fail) console.log('FAILED: ' + msgs.join(', '));
    window.__selftest = { pass: pass, fail: fail };
  }

  function probe() {
    return JSON.stringify({
      build: BUILD,
      cam: R.camera ? R.camera.position.toArray().map(function (v) { return +v.toFixed(3); }) : null,
      coins: Sim.coins.length,
      fall: Sim.fall.length,
      fallY: Sim.fall.slice(0, 3).map(function (c) { return +c.fy.toFixed(3); }),
      floorY: Sim.FLOOR_Y,
      props: Sim.countProps(),
      order: app.state.order ? app.state.order.slice() : null,
      nextPropIdx: app.state.nextPropIdx,
      respawn: app.state.respawn ? app.state.respawn.slice() : null,
      hist: Sim.layerHistogram(),
      plate: +Sim.front.toFixed(3),
      onPlate: Sim.countOnPlate(),
      stats: Sim.stats,
      stage: app.state.stageIdx,
      wallet: app.state.coins,
      drops: app.state.drops,
      collected: Object.keys(UI.state.collected).length,
      started: app.state.started,
      // The shake meter is the one HUD number a screenshot can lie about, so
      // the probe reports the numbers ui.js is actually being fed.
      slap: {
        left: slapBudget,
        max: SLAP_MAX,
        ratio: +slapRatio().toFixed(3),
        cooldownMs: Math.round(SLAP_COOLDOWN * 1000)
      },
      input: {
        aimX: +aim.x.toFixed(3),
        dragging: aim.dragging,
        moved: +gesture.moved.toFixed(0),
        gid: gesture.id,
        busy: !!Sim.busy,
        // gold in the payout slot, red over the gutter: the only HUD cue
        // that lives on the table, so it has to be provable headlessly
        inSlot: Math.abs(aim.x) <= Sim.PAY_W
      },
      // a shake is the one cue a screenshot cannot show at all
      shake: R.shakeState ? R.shakeState() : null,
      // so is a landing pool, and it is the only feedback a paid coin leaves
      glow: R.glowState ? R.glowState() : null,
      // and so is the marker's colour, which is the one thing on the table
      // that tells the player where their money is going
    });
  }

  // Test seam: a bot needs to drive the same code the player drives, not a
  // copy of it. Guarded by ?bot so a normal visitor never sees it. Installed
  // from boot(): this script runs while the document is still parsing, so a
  // readyState check here is always 'loading'.
  function installBot() {
    if (!/[?&]bot\b/.test(location.search)) return;
    window.__bot = {
      drop: drop,
      dropAt: function (x) { aim.x = x; drop(); },
      surface: maybeSurfaceProp,
      stage: function () { return stage(); },
      state: app.state,
      applyStage: applyStage,
      // Deterministic fast-forward: run the real step/payout/callback path
      // without waiting for requestAnimationFrame. Headless swiftshader renders
      // at ~4 fps, so a 40 s wall-clock bot run only advances ~9 s of sim --
      // less than a few plate strokes. This seam drives the same code the
      // frame loop does, just at test speed.
      advance: function (seconds, opts) {
        opts = opts || {};
        var every = opts.every || 1.2;
        var acc2 = 0, nextDrop = 0, t = 0, guard = 0;
        while (t < seconds && guard++ < 400000) {
          if (opts.dropAt != null && t >= nextDrop) { aim.x = opts.dropAt; drop(); nextDrop += every; }
          Sim.step(Sim.STEP);
          // Fast-forward is real time compressed, so the shake meter recharges
          // with it; otherwise a headless run would show a dead button forever.
          stepSlap(Sim.STEP);
          t += Sim.STEP; acc2 += Sim.STEP;
          if (acc2 >= 1 / 60) { Sim.stepFall(acc2); acc2 = 0; }
        }
        if (acc2 > 0) Sim.stepFall(acc2);
        return { t: +Sim.t.toFixed(2), stats: JSON.parse(JSON.stringify(Sim.stats)) };
      },
      // Press 拍機 through the same handler the button uses.
      slap: function () { UI.onSlap(); },
      slapState: function () {
        return { left: slapBudget, max: SLAP_MAX, ratio: +slapRatio().toFixed(3) };
      }
    };
  }

  function start() {
    installBot();
    boot();
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})(window);
