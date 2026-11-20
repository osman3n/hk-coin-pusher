/* 一蚊雞 — ui.js
 * HUD, collect card, museum, machine voice, events. No game rules live here.
 */
(function (G) {
  'use strict';

  var C = G.CONTENT;
  var UI = {};
  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  var state = {
    collected: {},      // propId -> true
    stageIdx: 0,
    coins: 0,
    found: [],          // this stage's collected prop ids in order
    cardOpen: false,
    onCardClose: null
  };

  UI.state = state;

  // tiny synth: the whole soundtrack, zero bytes
  var AC = null, muted = false;
  function audio() {
    if (muted) return null;
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function blip(freq, dur, type, gain, slideTo) {
    var ac = audio(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(gain == null ? 0.06 : gain, ac.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function clink() {
    var ac = audio(); if (!ac) return;
    var n = ac.createBufferSource();
    var len = Math.floor(ac.sampleRate * 0.07);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 7);
    n.buffer = buf;
    var bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random() * 1400; bp.Q.value = 9;
    var g = ac.createGain(); g.gain.value = 0.20;
    n.connect(bp); bp.connect(g); g.connect(ac.destination);
    n.start();
  }
  function rumble() {
    var ac = audio(); if (!ac) return;
    var len = Math.floor(ac.sampleRate * 0.5);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    var n = ac.createBufferSource(); n.buffer = buf;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    var g = ac.createGain(); g.gain.value = 0.13;
    n.connect(lp); lp.connect(g); g.connect(ac.destination);
    n.start();
  }
  function chime() {
    blip(660, 0.16, 'triangle', 0.05);
    setTimeout(function () { blip(880, 0.22, 'triangle', 0.05); }, 80);
    setTimeout(function () { blip(1180, 0.30, 'triangle', 0.045); }, 170);
  }
  UI.clink = clink; UI.rumble = rumble; UI.chime = chime;
  UI.setMuted = function (v) { muted = v; };

  // ── boot ───────────────────────────────────────────────────────────────
  UI.init = function () {
    els.coins = $('coins');
    els.year = $('year');
    els.stageName = $('stageName');
    els.bigRow = $('bigRow');
    els.machine = $('machine');
    els.card = $('card');
    els.museum = $('museum');
    els.museumGrid = $('museumGrid');
    els.done = $('done');
    els.start = $('start');

    $('museumBtn').onclick = function () { UI.openMuseum(); };
    $('museumClose').onclick = function () { els.museum.classList.remove('on'); };
    $('cardClose').onclick = function () { UI.closeCard(); };
    $('soundBtn').onclick = function () {
      muted = !muted;
      this.textContent = muted ? '♪ 關' : '♪ 開';
    };
    $('slapBtn').onclick = function () { if (UI.onSlap) UI.onSlap(); };
    $('sGo').onclick = function () {
      audio();                                  // must be inside the gesture
      els.start.classList.add('off');
      if (UI.onStart) UI.onStart();
    };
    $('doneStay').onclick = function () { els.done.classList.remove('on'); };
    $('doneNext').onclick = function () {
      els.done.classList.remove('on');
      if (UI.onNextStage) UI.onNextStage();
    };
    els.museum.onclick = function (e) { if (e.target === els.museum) els.museum.classList.remove('on'); };
  };

  // ── stage chrome ───────────────────────────────────────────────────────
  UI.stage = function () { return state.stage; };

  UI.setStage = function (stage, idx) {
    state.stageIdx = idx;
    state.stage = stage;
    els.year.textContent = stage.year;
    els.stageName.textContent = stage.name;
    document.body.style.setProperty('--gold',
      '#' + stage.palette.sign.toString(16).padStart(6, '0'));
    renderBigChips(stage);
  };

  function renderBigChips(stage) {
    els.bigRow.innerHTML = '';
    // Every collectible in the stage, not only the three big ones. The six
    // small props were collectable and were silently unusable: showCard()
    // tried to light up a chip that renderBigChips never created, so a player
    // who won 垃圾蟲 saw a card, then nothing anywhere that remembered it.
    var all = stage.big.concat(stage.small);
    all.forEach(function (id) {
      var def = C.PROPS[id];
      if (!def) return;
      var isBig = stage.big.indexOf(id) >= 0;
      var d = document.createElement('div');
      d.className = 'chip' + (state.collected[id] ? ' got' : '') + (isBig ? ' big' : '');
      d.dataset.id = id;
      d.innerHTML = '<span class="dot"></span><span>' + def.name + '</span>';
      els.bigRow.appendChild(d);
    });
    UI.setBigCount(stage);
  }

  // "2 / 9" so the row says how much of the stage is left, not just which
  // chips happen to be lit.
  UI.setBigCount = function (stage) {
    var el = $('bigCount');
    if (!el) return;
    var all = stage.big.concat(stage.small);
    var got = all.filter(function (id) { return !!state.collected[id]; }).length;
    el.textContent = got + ' / ' + all.length;
  };

  UI.setCoins = function (n) {
    state.coins = n;
    els.coins.textContent = n;
  };

  UI.tick = function (n) {
    // roll the counter up so a payout reads as a payout
    var from = state.coins, to = n, t0 = performance.now();
    if (from === to) return;
    (function anim() {
      var k = Math.min(1, (performance.now() - t0) / 280);
      var v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 2)));
      els.coins.textContent = v;
      if (k < 1) requestAnimationFrame(anim);
      else { state.coins = to; els.coins.textContent = to; }
    })();
  };

  // ── the machine speaks ─────────────────────────────────────────────────
  var speakTimer = null;
  UI.say = function (text, hold) {
    if (!text) return;
    els.machine.textContent = text;
    els.machine.classList.add('on');
    if (speakTimer) clearTimeout(speakTimer);
    speakTimer = setTimeout(function () { els.machine.classList.remove('on'); }, hold || 3400);
    blip(220 + Math.random() * 40, 0.05, 'square', 0.018);
  };

  UI.randomLine = function (pool, chance) {
    if (Math.random() > (chance == null ? 0.5 : chance)) return;
    if (!pool || !pool.length) return;
    UI.say(pool[Math.floor(Math.random() * pool.length)]);
  };

  UI.hideHint = function () {
    var h = $('hint'); if (h) h.style.opacity = '0';
  };

  // ── collect card ───────────────────────────────────────────────────────
  UI.showCard = function (propId, onClose) {
    var def = C.PROPS[propId];
    if (!def) return;
    state.cardOpen = true;
    state.onCardClose = onClose || null;
    if (!state.collected[propId]) {
      state.collected[propId] = true;
      state.found.push(propId);
      var chip = els.bigRow.querySelector('[data-id="' + propId + '"]');
      if (chip) {
        chip.classList.add('got', 'justgot');
        // scroll the newly won chip into view: on a phone the row is a
        // horizontal strip and the item you just earned can be off-screen
        try { chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) {}
        // drop the pulse class afterwards so a second win can replay it
        setTimeout(function () { chip.classList.remove('justgot'); }, 950);
      }
      var st = UI.stage && UI.stage();
      if (st) UI.setBigCount(st);
    }
    $('cardName').textContent = def.name;
    $('cardJyut').textContent = def.jyut || '';
    var owner = def.owner ? C.PEOPLE[def.owner] : null;
    $('cardOwner').textContent = owner ? ('屬於 ' + owner.name + ' · ' + owner.note) : '冇人認領';
    $('cardMem').innerHTML = def.mem || '';
    try { $('cardImg').src = G.R.thumb(propId); } catch (e) { $('cardImg').removeAttribute('src'); }
    els.card.classList.add('on');
    chime();
  };

  UI.closeCard = function () {
    state.cardOpen = false;
    els.card.classList.remove('on');
    var cb = state.onCardClose; state.onCardClose = null;
    if (cb) setTimeout(cb, 260);
  };

  UI.isCardOpen = function () { return state.cardOpen; };

  // ── museum ─────────────────────────────────────────────────────────────
  UI.openMuseum = function () {
    els.museumGrid.innerHTML = '';
    var stages = C.STAGES;
    stages.forEach(function (st) {
      var ids = st.big.concat(st.small);
      var gotN = ids.filter(function (id) { return state.collected[id]; }).length;
      var head = document.createElement('div');
      head.style.cssText = 'grid-column:1/-1;margin:14px 0 4px;font-size:11px;letter-spacing:.24em;color:#9c8f7c';
      head.textContent = st.year + ' · ' + st.shop + '　' + gotN + '/' + ids.length;
      els.museumGrid.appendChild(head);
      ids.forEach(function (id) {
        var def = C.PROPS[id], got = !!state.collected[id];
        var d = document.createElement('div');
        d.className = 'mu' + (got ? ' got' : '');
        var img = '<div style="width:100%;aspect-ratio:1"></div>';
        if (got) { try { img = '<img alt="" src="' + G.R.thumb(id) + '">'; } catch (e) {} }
        d.innerHTML = img + '<div class="n">' + (got ? def.name : '？？？') +
          '</div><div class="b">' + (got && def.big ? '大件' : '') + '</div>';
        els.museumGrid.appendChild(d);
      });
    });
    els.museum.classList.add('on');
  };

  // ── stage complete ─────────────────────────────────────────────────────
  UI.showStageDone = function (stage, isLast) {
    $('doneYear').textContent = stage.year;
    $('doneMsg').textContent = stage.done;
    $('doneNext').textContent = isLast ? '睇下機底' : '翻新部機';
    els.done.classList.add('on');
  };

  // ── collect checklist ──────────────────────────────────────────────────
  UI.bigComplete = function (stage) {
    return stage.big.every(function (id) { return !!state.collected[id]; });
  };

  UI.save = function () {
    try {
      localStorage.setItem('yatmangai.save.v1', JSON.stringify({
        v: 1, stageIdx: state.stageIdx, coins: state.coins, collected: state.collected
      }));
    } catch (e) {}
  };

  UI.load = function () {
    try {
      var raw = localStorage.getItem('yatmangai.save.v1');
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || s.v !== 1) return false;
      state.collected = s.collected || {};
      state.stageIdx = s.stageIdx || 0;
      state.coins = s.coins || 0;
      return true;
    } catch (e) { return false; }
  };

  G.UI = UI;
})(window);
