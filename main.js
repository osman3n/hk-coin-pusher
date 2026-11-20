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
  var COINS_PER_PROP = 14;

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
    coins: 24,
    paidSinceProp: 0,
    nextPropIdx: 0,
    spent: 0,
    lost: 0,
    drops: 0,
    started: false
  };

  function stage() { return C.STAGES[app.state.stageIdx]; }

  function applyStage(idx, keepSave) {
    app.state.stageIdx = idx;
    var st = C.STAGES[idx];
    app.state.paidSinceProp = 0;
    app.state.nextPropIdx = 0;
    R.setCabinet(st.palette);
    UI.setStage(st, idx);
    Sim.reset(1000 + idx);
    Sim.onPayout = onPayout;
    Sim.onBigPayout = onBigPayout;
    Sim.onLost = onLost;
    Sim.seedPile(56 + idx * 4);
    // coins are the wallet and survive an era change; only the table is rebuilt
    UI.setCoins(app.state.coins);
    if (!keepSave) UI.say(st.open, 4200);
  }

  // Spawn the next uncollected prop for this stage, from the back of the table.
  // Small props come out first and thickest: they are the pile's filler, and
  // they teach the player that the table pays before the big ones ask for
  // real effort. Big props are interleaved so none sits last as a wall.
  function stageOrder(st) {
    var order = [], s = st.small.slice(), b = st.big.slice();
    var i;
    for (i = 0; i < s.length; i++) {
      order.push(s[i]);
      if (i % 2 === 1 && b.length) order.push(b.shift());
    }
    while (b.length) order.push(b.shift());
    return order;
  }

  function maybeSurfaceProp() {
    var st = stage();
    if (!app.state.order || app.state.orderStage !== st.id) {
      app.state.order = stageOrder(st);
      app.state.orderStage = st.id;
    }
    var order = app.state.order;
    while (app.state.nextPropIdx < order.length) {
      var id = order[app.state.nextPropIdx++];
      if (UI.state.collected[id]) continue;
      if (Sim.hasProp(id)) continue;
      var T = Sim.TABLE;
      var x = T.x0 + 0.10 + Math.random() * (T.x1 - T.x0 - 0.20);
      var z = T.z0 + 0.10 + Math.random() * 0.10;
      var c = Sim.spawn(x, z, 'prop', id);
      c.fallT = 0.38; c.cy = 0.55;
      var isBig = st.big.indexOf(id) >= 0;
      if (isBig) { UI.say(pick(C.MACHINE.bigFall)); }
      return c;
    }
    return null;
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function onPayout(coin) {
    app.state.coins++;
    UI.tick(app.state.coins);
    UI.clink();
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
    if (app.state.lost % 2 === 1) UI.say(pick(C.MACHINE.lost), 1800);
  }

  function onBigPayout(coin) {
    var id = coin.prop;
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
          UI.showStageDone(stage(), isLast);
        }, 620);
      } else {
        UI.say(pick(C.MACHINE.win), 2200);
      }
    });
  }

  UI.onNextStage = function () {
    if (app.state.stageIdx >= C.STAGES.length - 1) {
      UI.say('冇下一個年代。得返樓梯底。', 6000);
      Sim.busy = false;
      return;
    }
    Sim.busy = false;
    app.state.stageIdx++;
    applyStage(app.state.stageIdx);
    UI.save();
  };

  // ── loop ───────────────────────────────────────────────────────────────
  function frame(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
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

    // aim marker
    if (app.aimRibbon) {
      app.aimRibbon.position.x = aim.x;
      app.aimRibbon.visible = !Sim.busy;
    }

    R.sync(Sim, dt);
    R.render();
    requestAnimationFrame(frame);
  }

  // ── slap ───────────────────────────────────────────────────────────────
  var slapBudget = 3, slapReset = 0;
  UI.onSlap = function () {
    if (Sim.busy) return;
    if (slapBudget <= 0) { UI.say('冇力喇。', 1800); return; }
    slapBudget--;
    slapReset = performance.now() + 4200;
    UI.say(pick(C.MACHINE.slap), 2200);
    UI.rumble();
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
    if (loaded) app.state.coins = UI.state.coins || 0;
    if (!loaded || app.state.coins <= 0) app.state.coins = 24;
    applyStage(loaded ? UI.state.stageIdx : 0, loaded);

    // aim ribbon: a thin glowing line above the drop rail
    app.aimRibbon = buildAimRibbon();
    R.scene.add(app.aimRibbon);

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
  }

  // The aim marker. It used to be a flat 300 mm plate lying at rail height,
  // which the cabinet side panel cut in half -- on screen it read as a stray
  // gold diagonal rather than an indicator. Now it is a short marker in the
  // drop corridor plus a ring on the table where the coin will actually land.
  function buildAimRibbon() {
    var THREE = G.THREE;
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({
      color: 0xffb347, transparent: true, opacity: 0.5, depthWrite: false
    });
    var solid = new THREE.MeshBasicMaterial({
      color: 0xffd28a, transparent: true, opacity: 0.85, depthWrite: false
    });
    // a short dashed guide down the drop corridor, not a full table-length line
    for (var i = 0; i < 3; i++) {
      var d = new THREE.Mesh(new THREE.PlaneGeometry(0.010, 0.035), mat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(0, 0.058, -0.30 + i * 0.062);
      g.add(d);
    }
    // landing ring, sitting just above the pile so it is never buried
    var head = new THREE.Mesh(new THREE.RingGeometry(0.030, 0.040, 22), solid);
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0.070, G.Sim.DROP_Z);
    g.add(head);
    var core = new THREE.Mesh(new THREE.CircleGeometry(0.016, 18), mat);
    core.rotation.x = -Math.PI / 2;
    core.position.set(0, 0.070, G.Sim.DROP_Z);
    g.add(core);
    return g;
  }

  // ── input ──────────────────────────────────────────────────────────────
  // Tap-versus-drag matters here. On a desktop, press-move-release over the
  // table reads naturally as "aim, then drop". On a phone the same gesture is
  // how you scroll, and a stray 2 px wobble would silently fire a coin. So a
  // gesture that stays within a fingertip is treated as a tap on release, and
  // a gesture that travels is treated as aiming with an explicit second tap
  // to commit -- except on mouse, where the original press-drag-release stands.
  var TAP_SLOP = 14;          // px of travel still counted as a tap
  var gesture = { id: null, x0: 0, y0: 0, moved: 0, mouse: false };

  function wireInput() {
    function down(x, y, mouse) {
      if (Sim.busy) return;
      pointer.x = x; pointer.y = y;
      gesture.x0 = x; gesture.y0 = y; gesture.moved = 0; gesture.mouse = !!mouse;
      aim.dragging = true;
      updateAim(x, y);
    }
    function move(x, y) {
      pointer.x = x; pointer.y = y;
      if (!aim.dragging) { updateAim(x, y); return; }
      gesture.moved = Math.max(gesture.moved, Math.hypot(x - gesture.x0, y - gesture.y0));
      updateAim(x, y);
    }
    function up(x, y) {
      if (!aim.dragging) return;
      aim.dragging = false;
      if (Sim.busy) return;
      updateAim(x, y);
      // A touch that barely moved is a tap and drops; a touch that dragged is
      // left as a positioned aim, and the player taps again to commit. A mouse
      // drag always drops, because dragging is not how it scrolls anything.
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

    // 2. a coin behind the plate at its back position is not pushed
    var s2 = Sim.create(); s2.reset(8); s2.seedPile(0);
    var c2 = s2.spawn(0, Sim.TABLE.z0 + 0.02, 'coin');
    c2.fallT = 0; var z2 = c2.z;
    for (var j = 0; j < 340; j++) s2.step(Sim.STEP);
    ok('coin behind plate not pushed', Math.abs(c2.z - z2) < 0.02, 'dz=' + (c2.z - z2).toFixed(4));

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
      cam: R.camera ? R.camera.position.toArray().map(function (v) { return +v.toFixed(3); }) : null,
      coins: Sim.coins.length,
      fall: Sim.fall.length,
      fallY: Sim.fall.slice(0, 3).map(function (c) { return +c.fy.toFixed(3); }),
      trayY: Sim.TRAY_Y,
      props: Sim.countProps(),
      hist: Sim.layerHistogram(),
      plate: +Sim.plateFront.toFixed(3),
      stats: Sim.stats,
      stage: app.state.stageIdx,
      wallet: app.state.coins,
      drops: app.state.drops,
      collected: Object.keys(UI.state.collected).length,
      started: app.state.started,
      input: {
        aimX: +aim.x.toFixed(3),
        dragging: aim.dragging,
        moved: +gesture.moved.toFixed(0),
        gid: gesture.id,
        busy: !!Sim.busy
      }
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
      applyStage: applyStage
    };
  }

  function start() {
    installBot();
    boot();
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})(window);
