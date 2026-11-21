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
    onCardClose: null,
    mdOpen: false,      // museum detail panel open?
    mdId: null,         // which prop the panel is showing
    storySeen: {},      // stage id -> true, so a beat is read once per save
    storyTab: false,    // the museum is showing 故事線 instead of 藏品
    settingsFromMuseum: false,
    // The furthest decade reached. Progress is worth keeping separate from the
    // current stage: walking back to 1972 to re-shove a prize must not lock the
    // decades you have already opened.
    maxStage: 0
  };

  UI.state = state;

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function txt(el, s) { if (el) el.textContent = (s == null ? '' : String(s)); }

  // Restart a one-shot CSS animation even if its class is still on the
  // element, so two slaps in a row both read as two taps.
  var flashTimers = {};
  function flash(el, cls, hold) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;                      // reflow: CSS animations restart
    el.classList.add(cls);
    clearTimeout(flashTimers[cls]);
    flashTimers[cls] = setTimeout(function () { el.classList.remove(cls); }, hold || 900);
  }

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
  // The upper deck is the part a new player cannot see the point of: a coin
  // riding it makes no money. Give the cascade a small dry tick so the deck
  // is audibly alive, and the drop that follows reads as an answer to it.
  function ping() {
    var ac = audio(); if (!ac) return;
    var n = ac.createBufferSource();
    var len = Math.max(1, Math.floor(ac.sampleRate * 0.045));
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
    n.buffer = buf;
    var bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200 + Math.random() * 600; bp.Q.value = 6;
    var g = ac.createGain(); g.gain.value = 0.055;
    n.connect(bp); bp.connect(g); g.connect(ac.destination);
    n.start();
  }
  // The prize moment gets a body, not just a chime: a low tone under the
  // sparkle, because the collection card is the loudest thing in the game.
  function boom() {
    var ac = audio(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(196, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(64, ac.currentTime + 0.42);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ac.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.55);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.6);
  }
  UI.clink = clink; UI.rumble = rumble; UI.chime = chime;
  UI.shuttlePing = ping; UI.boom = boom;
  // One mute path. UI.setMuted() used to assign the flag behind the switch's
  // back, leaving the UI painting the opposite of the truth; it now goes
  // through exactly the same commit the switch does.
  UI.setMuted = function (v) { commitMuted(!!v); };

  // ── 故事線 ───────────────────────────────────────────────────────────
  // CONTENT.STORY is optional: a build without it simply never shows a story.
  // Everything here reads through story() and returns quietly when it is absent,
  // because the title screen, the done card and the museum all call into it
  // unconditionally.
  function story() {
    var s = C && C.STORY;
    if (!s || !s.title) return null;
    return s;
  }
  // STAGES and STORY.beats are authored in the same order; match by id first so
  // a reordered or extra beat can never land on the wrong year.
  function beatFor(stage, idx) {
    var s = story();
    if (!s || !s.beats || !s.beats.length) return null;
    var id = stage && stage.id;
    for (var i = 0; i < s.beats.length; i++) {
      if (id && s.beats[i] && s.beats[i].stage === id) return s.beats[i];
    }
    var b = s.beats[idx];
    return (b && b.line) ? b : null;
  }
  function storyStageReached(id) {
    var stages = (C && C.STAGES) || [];
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].id === id) return i <= state.stageIdx;
    }
    return true;                                  // unknown stage: do not lie
  }
  function markSeen(stage) {
    var s = story();
    if (!s || !stage || !stage.id) return false;
    if (state.storySeen[stage.id]) return false;
    state.storySeen[stage.id] = true;
    return true;
  }

  // Title screen: the title and the one sentence that sets the machine up.
  function paintStartStory() {
    var s = story();
    var wrap = $('sStory');
    if (!wrap) return;
    if (!s) { hide(wrap); return; }
    txt($('sStoryTitle'), s.title);
    txt($('sStoryPremise'), s.premise || '');
    show(wrap);
  }

  // Museum 故事線 tab: every beat, in order, with its year. A beat the player
  // has not reached is muted exactly like an uncollected prop.
  function paintStoryTab() {
    var s = story();
    var wrap = $('museumStory');
    if (!wrap) return;
    if (!s) { hide(wrap); hide($('museumTabs')); return; }
    show($('museumTabs'));
    var premise = $('stPremise');
    txt(premise, s.premise || '');
    if (premise) premise.hidden = !s.premise;

    var list = $('stList');
    if (list) {
      list.innerHTML = '';
      var beats = s.beats || [];
      beats.forEach(function (b, i) {
        if (!b) return;
        var reached = storyStageReached(b.stage);
        var year = yearOfStage(b.stage, i);
        var li = document.createElement('li');
        li.className = 'stBeat' + (reached ? '' : ' locked');
        li.dataset.stage = b.stage || '';
        if (!reached) li.setAttribute('aria-hidden', 'true');   // nothing to read yet
        var y = document.createElement('span');
        y.className = 'stY';
        y.textContent = reached && year != null ? year : '？？？';
        var l = document.createElement('span');
        l.className = 'stL';
        l.textContent = reached ? String(b.line || '') : '未行到呢一年';
        li.appendChild(y);
        li.appendChild(l);
        list.appendChild(li);
      });
    }

    var end = $('stEnd');
    if (end) {
      var e = s.ending;
      // The ending is the payoff of the whole line: only once it is reached.
      var last = (C.STAGES && C.STAGES[C.STAGES.length - 1]) || null;
      var reachedEnd = !last || storyStageReached(last.id);
      if (e && e.line) {
        txt($('stEndLine'), reachedEnd ? e.line : '？？？');
        txt($('stEndText'), reachedEnd ? (e.text || '') : '');
        end.classList.toggle('locked', !reachedEnd);
        if (!reachedEnd) end.setAttribute('aria-hidden', 'true');
        else end.removeAttribute('aria-hidden');
        show(end);
      } else hide(end);
    }
  }
  function yearOfStage(id, idx) {
    var stages = (C && C.STAGES) || [];
    for (var i = 0; i < stages.length; i++) if (stages[i].id === id) return stages[i].year;
    return (stages[idx] && stages[idx].year) || null;
  }

  function setStoryTab(on) {
    var grid = $('museumGrid'), detail = $('museumDetail'), box = $('museumStory');
    // No story in this build: the tab does not exist and cannot be switched to.
    if (on && !story()) on = false;
    state.storyTab = !!on;
    var tabs = $('museumTabs');
    if (tabs) { if (story()) show(tabs); else hide(tabs); }
    var tabG = $('mtabGrid'), tabS = $('mtabStory');
    if (tabG && tabS) {
      tabG.classList.toggle('on', !state.storyTab);
      tabS.classList.toggle('on', state.storyTab);
      tabG.setAttribute('aria-pressed', String(!state.storyTab));
      tabS.setAttribute('aria-pressed', String(state.storyTab));
    }
    if (state.storyTab) {
      paintStoryTab();
      if (grid) grid.hidden = true;
      if (detail) detail.hidden = true;
      if (box) box.hidden = false;
      txt(els.museumTitle, '故事線');
    } else {
      if (box) box.hidden = true;
      if (grid) grid.hidden = false;
      txt(els.museumTitle, '香港嘢博物館');
    }
    if (els.museumScroll) els.museumScroll.scrollTop = 0;
  }
  UI.setStoryTab = setStoryTab;

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
    els.museumDetail = $('museumDetail');
    els.museumScroll = $('museumScroll');
    els.museumTitle = $('museumTitle');
    els.md = {
      img: $('mdImg'), name: $('mdName'), en: $('mdEn'), jyut: $('mdJyut'),
      tags: $('mdTags'), mem: $('mdMem'), use: $('mdUse'), fact: $('mdFact'),
      owner: $('mdOwner'), memWrap: $('mdMemWrap'), useWrap: $('mdUseWrap'),
      factWrap: $('mdFactWrap'), ownerWrap: $('mdOwnerWrap'),
      back: $('mdBack'), note: $('mdNote')
    };
    els.done = $('done');
    els.start = $('start');
    els.live = $('live');
    els.settings = $('settings');
    els.settingsScroll = $('settingsScroll');
    els.stageBox = $('stageBox');
    els.eras = $('eras');
    els.erasNow = $('erasNow');
    els.erasList = $('erasList');
    els.renew = $('renew');

    $('museumBtn').onclick = function () { UI.openMuseum(); };
    // 返去 walks back one level, exactly like Escape.
    $('museumClose').onclick = function () {
      if (state.mdOpen) UI.closeMuseumDetail();
      else if (state.storyTab) setStoryTab(false);
      else UI.closeMuseum();
    };
    if ($('mtabGrid')) $('mtabGrid').onclick = function () { setStoryTab(false); };
    if ($('mtabStory')) $('mtabStory').onclick = function () { setStoryTab(true); };
    $('mdBack').onclick = function () { UI.closeMuseumDetail(); };
    $('cardClose').onclick = function () { UI.closeCard(); };
    $('slapBtn').onclick = function () { if (UI.onSlap) UI.onSlap(); };

    // ── settings ─────────────────────────────────────────────────────────
    // Settings is not a thing you do at the table. The main screen keeps the
    // two controls a player actually touches mid-game -- 拍機 and the prize
    // cabinet -- and the switch and reset hang off the cabinet instead.
    $('museumSettings').onclick = function () { UI.openSettings(); };
    // 年代 lives on the HUD, behind the year the player is already reading.
    // A separate button on the table would be a fourth control on a screen
    // that is supposed to have two.
    els.stageBox.onclick = function () { UI.openEras(); };
    $('erasClose').onclick = function () { UI.closeEras(); };
    $('renewOk').onclick = function () { UI.closeRenew(); };
    $('settingsClose').onclick = function () { UI.closeSettings(); };
    $('soundToggle').onclick = function () { UI.toggleMuted(); };
    $('settingsReset').onclick = function () { armReset(); };
    els.settings.onclick = function (e) {
      if (e.target !== els.settings) return;
      UI.closeSettings();
    };

    $('sGo').onclick = function () {
      audio();                                  // must be inside the gesture
      els.start.classList.add('off');
      if (UI.onStart) UI.onStart();
    };
    $('doneStay').onclick = function () {
      els.done.classList.remove('on');
      // main.js freezes the world while the card is up. 再推多陣 must hand the
      // game back, or the player is left with a table they cannot drop onto.
      if (UI.onStayStage) UI.onStayStage();
      else if (G.Sim) G.Sim.busy = false;
    };
    $('doneNext').onclick = function () {
      els.done.classList.remove('on');
      if (UI.onNextStage) UI.onNextStage();
    };
    els.eras.onclick = function (e) {
      if (e.target !== els.eras) return;
      UI.closeEras();
    };
    els.renew.onclick = function (e) {
      if (e.target !== els.renew) return;
      UI.closeRenew();
    };
    els.museum.onclick = function (e) {
      if (e.target !== els.museum) return;
      if (state.mdOpen) UI.closeMuseumDetail();
      else UI.closeMuseum();
    };

    els.slapBtn = $('slapBtn');
    els.slapN = $('slapN');
    els.slapFill = $('slapFill');
    // Until main.js reports in, show the full budget the markup advertises.
    UI.slapState({ left: 3, max: 3, ratio: 0 });

    paintStartStory();

    // Escape walks back one level at a time; it never closes the page.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (els.card.classList.contains('on')) { UI.closeCard(); return; }
      if (els.renew.classList.contains('on')) { e.preventDefault(); UI.closeRenew(); return; }
      if (els.eras.classList.contains('on')) { e.preventDefault(); UI.closeEras(); return; }
      if (els.settings.classList.contains('on')) { e.preventDefault(); UI.closeSettings(); return; }
      if (!els.museum.classList.contains('on')) return;
      e.preventDefault();
      if (state.mdOpen) UI.closeMuseumDetail();
      else if (state.storyTab) setStoryTab(false);
      else UI.closeMuseum();
    });
    document.addEventListener('keydown', trapTab);
  };

  // ── 拍機 charge meter ─────────────────────────────────────────────────
  // main.js owns the budget; ui.js only draws it. left = charges in hand,
  // max = ceiling, ratio = 0..1 refill toward the next charge.
  var slap = { left: 3, max: 3, ratio: 0, known: false };
  var slapped = { left: -1, max: -1, pct: -1 };   // last values actually painted
  function paintSlap() {
    var max = Math.max(1, slap.max);
    var left = clamp(Math.round(slap.left), 0, max);
    var ratio = clamp(slap.ratio, 0, 1);
    var pct = Math.round(ratio * 100);
    // main.js may poll this every frame; only touch the DOM when it changed.
    if (left === slapped.left && max === slapped.max && (left > 0 || pct === slapped.pct)) return;
    slapped = { left: left, max: max, pct: left > 0 ? -1 : pct };
    if (els.slapN) els.slapN.textContent = left + '/' + max;
    var ready = left > 0;
    // Ready: the bar is the budget you have left. Empty: it is the refill.
    var fill = ready ? left / max : ratio;
    if (els.slapFill) {
      els.slapFill.style.transform = 'scaleX(' + fill.toFixed(3) + ')';
    }
    if (els.slapBtn) {
      els.slapBtn.classList.toggle('spent', !ready);
      if (ready) els.slapBtn.removeAttribute('aria-disabled');
      else els.slapBtn.setAttribute('aria-disabled', 'true');
      els.slapBtn.setAttribute('aria-label', ready
        ? ('拍機，仲有 ' + left + ' 次，滿 ' + max + ' 次')
        : ('拍機，冇力，差 ' + pct + '% 回氣'));
      var drip = els.slapBtn.querySelector('.slapN');
      if (drip) drip.setAttribute('title', left + ' / ' + max);
    }
  }
  UI.slapState = function (s) {
    if (!s) return;
    var max = num(s.max, slap.max) <= 0 ? 1 : num(s.max, slap.max);
    var left = clamp(num(s.left, slap.left), 0, max);
    var ratio = clamp(num(s.ratio, 0), 0, 1);
    var before = slap;
    slap = { left: left, max: max, ratio: ratio, known: true };
    paintSlap();
    // A charge coming back is the one moment the player must notice.
    if (before.known && left > before.left && before.left < max) {
      flash(els.slapBtn, 'recharged', 900);
      if (els.live) els.live.textContent = '拍機回咗一次力';
    }
  };
  UI.slapFired = function () {
    flash(els.slapBtn, 'firing', 320);
  };

  // ── stage chrome ───────────────────────────────────────────────────────
  UI.stage = function () { return state.stage; };

  UI.setStage = function (stage, idx) {
    state.stageIdx = idx;
    state.stage = stage;
    els.year.innerHTML = '';
    els.year.appendChild(document.createTextNode(stage.year));
    var caret = document.createElement('i');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    els.year.appendChild(caret);
    els.stageName.textContent = stage.name;
    if (els.stageBox) {
      els.stageBox.setAttribute('aria-label', '年代：' + stage.year + ' ' + stage.name + '，撳一下揀年代');
    }
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

  // A roll-up animation outlives the state it was started from: if the wallet
  // is rewritten mid-animation (重置進度), the tail of the old animation would
  // paint the old number back over the new one. Every writer bumps the token.
  var tickToken = 0;

  UI.setCoins = function (n) {
    tickToken++;
    state.coins = n;
    els.coins.textContent = n;
    combo.n = 0;
    paintCombo();
  };

  // The wallet is the only number the player acts on, so every reason it
  // changed has to be visible: the counter rolls up, and the plate takes one
  // short scale hit. The roll says "it went up"; the hit says "look here".
  function nudgeCoins() {
    var box = $('coinBox');
    if (!box) return;
    box.classList.remove('tick');
    void box.offsetWidth;
    box.classList.add('tick');
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(function () { box.classList.remove('tick'); }, 360);
  }
  var nudgeTimer = 0;

  // ── 連出 ───────────────────────────────────────────────────────────────
  // Payouts arrive in bursts while the plate sweeps, and a burst used to look
  // exactly like a single payout that happened to be worth more. Counting the
  // streak out loud gives the sweep a beginning and an end, which is the whole
  // reason a pusher feels good.
  var combo = { n: 0, t: 0, timer: 0 };
  var COMBO_HOLD_MS = 1500;

  function paintCombo() {
    var el = $('combo');
    if (!el) return;
    if (combo.n >= 2) {
      el.hidden = false;
      el.textContent = '×' + combo.n;
      // restart the entrance so the 3rd, 4th, 12th each read as a new one
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  UI.coinPaid = function () {
    var now = performance.now();
    combo.n = (now - combo.t > COMBO_HOLD_MS) ? 1 : combo.n + 1;
    combo.t = now;
    paintCombo();
    nudgeCoins();
    if (combo.timer) clearTimeout(combo.timer);
    combo.timer = setTimeout(function () { combo.n = 0; paintCombo(); }, COMBO_HOLD_MS + 120);
    return combo.n;
  };

  UI.tick = function (n) {
    // roll the counter up so a payout reads as a payout
    var from = state.coins, to = n, t0 = performance.now();
    if (from === to) return;
    var token = ++tickToken;
    (function anim() {
      if (token !== tickToken) return;
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
    var isNew = !state.collected[propId];
    if (isNew) {
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
    // A prize is the one moment allowed to interrupt: the card slides up, the
    // room shakes once, a low tone lands under the chime, and the ribbon says
    // what just happened in three characters.
    var tag = $('cardTag');
    if (tag) {
      tag.classList.remove('pop');
      void tag.offsetWidth;
      tag.classList.add('pop');
      txt(tag, isNew ? '新收藏' : '再攞一次');
    }
    els.card.classList.add('on');
    chime();
    boom();
    if (G.R && G.R.shake) G.R.shake(0.020, 280);
  };

  UI.closeCard = function () {
    state.cardOpen = false;
    els.card.classList.remove('on');
    var cb = state.onCardClose; state.onCardClose = null;
    if (cb) setTimeout(cb, 260);
  };

  UI.isCardOpen = function () { return state.cardOpen; };

  // ── museum ─────────────────────────────────────────────────────────────
  // Grid of every prop in every stage; a collected one is a button that opens
  // a readable detail panel, an uncollected one is inert and anonymous.
  function museumGrid() {
    els.museumGrid.innerHTML = '';
    els.museumGrid.hidden = false;
    els.museumDetail.hidden = true;
    state.mdOpen = false;
    state.mdId = null;
    txt(els.museumTitle, '香港嘢博物館');
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
        if (!def) return;
        d.dataset.id = id;
        if (got) {
          d = document.createElement('button');
          d.type = 'button';
          d.className = 'mu got';
          d.dataset.id = id;
          d.setAttribute('aria-label', def.name + '，睇詳細');
          d.addEventListener('click', function () { UI.openMuseumDetail(id); });
        } else {
          d.className = 'mu locked';
          d.setAttribute('aria-hidden', 'true');       // decorative: nothing to read
        }
        var inner = got
          ? '<img alt="" src="' + thumb(id) + '">'
          : '<div class="lockMark">?</div>';
        d.innerHTML = inner + '<div class="n">' + (got ? esc(def.name) : '未搵到') + '</div>' +
          '<div class="b">' + (got ? (def.big ? '大件' : '細件') : '') + '</div>';
        els.museumGrid.appendChild(d);
      });
    });
  }

  function thumb(id) {
    try { var u = G.R.thumb(id); return u ? String(u).replace(/"/g, '&quot;') : ''; }
    catch (e) { return ''; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // mem is authored HTML with <b> highlights; anything else could be plain.
  function memHtml(s) {
    if (s == null) return '';
    var str = String(s);
    return /<\/?[a-z][\s\S]*>/i.test(str) ? str : esc(str);
  }

  UI.openMuseum = function () {
    museumGrid();
    setStoryTab(false);
    els.museum.classList.add('on');
    setPageInert(true);
    if (els.museumScroll) els.museumScroll.scrollTop = 0;
    // Move focus in, but not into the grid: the close control is the exit.
    focusLater($('museumClose'));
  };

  UI.openMuseumDetail = function (propId) {
    var def = C.PROPS[propId];
    if (!def || !state.collected[propId]) return;   // locked stays locked
    var m = els.md;
    if (!m || !m.name) return;
    state.mdOpen = true;
    state.mdId = propId;

    txt(m.name, def.name);
    setLine(m.en, def.en ? def.en : null);
    setLine(m.jyut, def.jyut || null);

    if (m.img) {
      var src = thumb(propId);
      if (src) { m.img.src = src; m.img.alt = def.name + ' 立體圖'; }
      else { m.img.removeAttribute('src'); m.img.alt = ''; }
    }

    // Tags: year of the stage it belongs to (if the prop does not carry one)
    // and 大件/細件. The content contract adds def.year; use it when present.
    var year = num(def.year, stageYearOf(propId));
    if (m.tags) {
      m.tags.innerHTML = '';
      if (year != null) m.tags.appendChild(tag(year + ' 年', false));
      m.tags.appendChild(tag(def.big ? '大件' : '細件', true));
    }

    // owner: name + the recurring character's note, or anonymous.
    var owner = def.owner ? C.PEOPLE[def.owner] : null;
    if (m.owner) {
      if (owner) {
        m.owner.innerHTML = '<b>' + esc(owner.name) + '</b>' + (owner.note ? ' · ' + esc(owner.note) : '');
        show(m.ownerWrap);
      } else {
        m.owner.innerHTML = '冇人認領。跌喺機底嘅嘢，通常都係咁。';
        show(m.ownerWrap);
      }
    }

    setBlock(m.memWrap, function () { m.mem.innerHTML = memHtml(def.mem); }, def.mem);
    setBlock(m.useWrap, function () { txt(m.use, def.use); }, def.use);
    setBlock(m.factWrap, function () { txt(m.fact, def.fact); }, def.fact);

    if (m.note) {
      txt(m.note, year != null && def.year == null
        ? '呢件嘢，' + year + ' 年喺香港係日常。'
        : '');
    }

    els.museumGrid.hidden = true;
    els.museumDetail.hidden = false;
    txt(els.museumTitle, '藏品');
    if (els.museumScroll) els.museumScroll.scrollTop = 0;
    focusLater(m.back || $('museumClose'));
  };

  function stageYearOf(propId) {
    var stages = C.STAGES || [];
    for (var i = 0; i < stages.length; i++) {
      var st = stages[i];
      if (st.big.indexOf(propId) >= 0 || st.small.indexOf(propId) >= 0) return st.year;
    }
    return null;
  }
  function tag(text, plain) {
    var s = document.createElement('span');
    s.className = 'mdTag' + (plain ? '' : ' plain');
    s.textContent = text;
    return s;
  }
  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }
  function setLine(el, text) {
    if (!el) return;
    if (text == null || text === '') { el.textContent = ''; hide(el); return; }
    el.textContent = String(text);
    show(el);
  }
  function setBlock(wrap, paint, value) {
    if (!wrap) return;
    if (value == null || value === '') { hide(wrap); return; }
    paint();
    show(wrap);
  }

  UI.closeMuseumDetail = function () {
    if (!state.mdOpen) return;
    state.mdOpen = false;
    var backId = state.mdId;
    state.mdId = null;
    els.museumDetail.hidden = true;
    els.museumGrid.hidden = false;
    txt(els.museumTitle, '香港嘢博物館');
    if (els.museumScroll) els.museumScroll.scrollTop = 0;
    // Focus returns to the tile that opened the panel, so a keyboard or
    // screen-reader user lands where they left off (fallback: close button).
    var tile = backId && els.museumGrid.querySelector('[data-id="' + cssEsc(backId) + '"]');
    focusLater(tile || $('museumClose'));
  };

  UI.closeMuseum = function () {
    state.mdOpen = false;
    state.mdId = null;
    els.museum.classList.remove('on');
    setPageInert(false);
    if ($('museumBtn')) focusLater($('museumBtn'));
  };
  UI.isMuseumOpen = function () { return els.museum.classList.contains('on'); };

  // ── 年代: walk the machine back and forward ───────────────────────────
  // The machine is one physical object that has stood in seven shops. Deciding
  // to stay in a decade after clearing it used to be a dead end: the done card
  // offered 再推多陣 and nothing else, so 1980 was only reachable by clearing
  // 1972 again. Now the year on the HUD opens the list of every shop.
  function paintEras() {
    var cur = state.stageIdx;
    var top = Math.max(state.maxStage, cur);
    var now = C.STAGES[cur];

    // The header says what standing here costs and offers the one move the
    // list exists to make possible: go on.
    els.erasNow.innerHTML = '';
    if (now) {
      var line = document.createElement('div');
      line.className = 'goLine';
      var got = stageCount(now);
      line.innerHTML = '你而家喺 <b>' + esc(now.year) + ' · ' + esc(now.shop) + '</b>　' +
        got.got + ' / ' + got.total + ' 件';
      els.erasNow.appendChild(line);
    }
    var nextIdx = cur + 1;
    var cleared = now ? UI.bigComplete(now) : false;
    if (nextIdx < C.STAGES.length && (nextIdx <= top || cleared || nextIdx <= cur)) {
      var next = C.STAGES[nextIdx];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn primary';
      b.id = 'erasNext';
      b.textContent = (nextIdx <= top ? '去 ' : '翻新去 ') + next.year + ' · ' + next.shop;
      b.onclick = function () { UI.goStage(nextIdx); };
      els.erasNow.appendChild(b);
    } else if (nextIdx < C.STAGES.length && !cleared) {
      // Say why it is not there. A missing button reads as a bug; a sentence
      // reads as a rule the player can act on.
      var why = document.createElement('div');
      why.className = 'goLine';
      var need = now ? now.big.length : 3;
      var have = 0;
      if (now) now.big.forEach(function (id) { if (state.collected[id]) have++; });
      why.innerHTML = '收齊呢個年代嘅 <b>' + need + '</b> 件大件（而家 ' + have +
        ' 件），部機先會翻新去下一個年代。';
      els.erasNow.appendChild(why);
    }

    els.erasList.innerHTML = '';
    C.STAGES.forEach(function (st, i) {
      var cnt = stageCount(st);
      var open = i <= top;
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'era' + (i === cur ? ' cur' : '') +
        (i < cur && open ? ' back' : '') + (open ? '' : ' locked');
      row.dataset.idx = String(i);
      if (i === cur) {
        row.disabled = true;
        row.setAttribute('aria-current', 'true');
      } else if (!open) {
        row.disabled = true;
      }
      var label = st.year + ' ' + st.shop + '，' +
        (i === cur ? '而家喺呢度' : (!open ? '未開' : (i < cur ? '返去' : '去')));
      row.setAttribute('aria-label', label);
      row.innerHTML =
        '<span class="ey">' + esc(st.year) + '</span>' +
        '<span class="es"><span class="n">' + esc(st.shop) + '</span>' +
        '<span class="g">' + cnt.got + ' / ' + cnt.total + ' 件</span></span>' +
        '<span class="ev">' + (i === cur ? '而家' : (!open ? '未開' : (i < cur ? '返去' : '去'))) +
        '</span>';
      if (!row.disabled) {
        row.onclick = function () { UI.goStage(i); };
      }
      els.erasList.appendChild(row);
    });

    // Let a tab order user land on 去 1980 first: the list is long.
    focusLater($('erasNext') || $('erasClose'));
  }

  function stageCount(st) {
    var ids = (st.big || []).concat(st.small || []);
    var got = 0;
    ids.forEach(function (id) { if (state.collected[id]) got++; });
    return { got: got, total: ids.length };
  }

  UI.openEras = function () {
    if (!els.eras) return;
    paintEras();
    els.eras.classList.add('on');
    setPageInert(true);
    if (els.erasScroll) els.erasScroll.scrollTop = 0;
  };

  UI.closeEras = function () {
    if (!els.eras) return;
    els.eras.classList.remove('on');
    setPageInert(false);
    focusLater(els.stageBox);
  };

  UI.isErasOpen = function () { return !!els.eras && els.eras.classList.contains('on'); };

  // main.js owns the world; ui.js only asks for the move.
  UI.goStage = function (idx) {
    if (!(idx >= 0 && idx < C.STAGES.length)) return;
    UI.closeEras();
    if (UI.onGoStage) UI.onGoStage(idx);
  };

  // main.js calls this whenever the machine moves, so the HUD, the save and
  // the list all agree on which decade is open.
  UI.setMaxStage = function (n) {
    state.maxStage = Math.max(state.maxStage || 0, num(n, 0));
  };

  // ── 翻新: the reset has to be visible from the table ──────────────────
  // The settings sheet could say '搞好喇' as often as it liked; a player who
  // tapped 重置進度 and looked up saw the same machine, the same coins and the
  // same 0/9, and concluded nothing happened. This is the receipt.
  UI.showRenew = function (info) {
    if (!els.renew) return;
    info = info || {};
    var yearEl = $('renewYear'), msgEl = $('renewMsg'), statsEl = $('renewStats');
    txt(yearEl, info.year != null ? String(info.year) : '1972');
    txt(msgEl, info.msg ||
      '櫃清空咗，年代由第一間舖再開始。之前搵到嘅嘢冇喺度喇。');
    if (statsEl) {
      var cells = [
        { k: '年代', v: num(info.stages, 0), cls: 'up' },
        { k: '收藏', v: num(info.got, 0), cls: 'up' },
        { k: '蚊', v: num(info.coins, 0), cls: 'up' }
      ];
      statsEl.innerHTML = cells.map(function (c) {
        return '<div class="dsCol ' + c.cls + '"><div class="dsV">' + c.v +
          '</div><div class="dsK">' + c.k + '</div></div>';
      }).join('');
    }
    els.renew.classList.add('on');
    setPageInert(true);
    focusLater($('renewOk'));
  };

  UI.closeRenew = function () {
    if (!els.renew) return;
    els.renew.classList.remove('on');
    setPageInert(false);
    focusLater(els.stageBox);
  };

  UI.isRenewOpen = function () { return !!els.renew && els.renew.classList.contains('on'); };

  // ── settings ───────────────────────────────────────────────────────────
  // Same overlay family as the museum (#settings is a .ov), same inert +
  // focus contract. Nothing here invents a second modal system: the page is
  // one .ovHead + one .ovBody, and Esc / backdrop / 返去 all exit it.
  var RESET_ARM_MS = 3000;
  var resetArmTimer = 0;
  var resetArmed = false;

  UI.isMuted = function () { return muted; };
  // Sound is a player setting, so it is written through this one function:
  // commit the flag, paint the switch, persist. Nothing else touches `muted`.
  function commitMuted(v) {
    var changed = (muted !== v);
    muted = v;
    paintSound();
    if (changed) UI.save();
    return muted;
  }
  UI.toggleMuted = function () {
    commitMuted(!muted);
    // Turning sound back on should be audible immediately, or the switch reads
    // as broken; turning it off just goes quiet.
    if (!muted) blip(520, 0.12, 'triangle', 0.05, 760);
    return muted;
  };

  function paintSound() {
    var b = $('soundToggle'), s = $('soundToggleState');
    if (!b) return;
    b.setAttribute('aria-checked', muted ? 'false' : 'true');
    b.setAttribute('aria-label', muted ? '音效：關' : '音效：開');
    txt(s, muted ? '關' : '開');
  }

  // The sentence above the button has to be true, so it is read from live
  // state every time the page opens instead of being written once.
  function ownedCount() {
    var n = 0;
    try {
      var stages = (C && C.STAGES) || [];
      stages.forEach(function (st) {
        ((st.big || []).concat(st.small || [])).forEach(function (id) {
          if (UI.state.collected[id]) n++;
        });
      });
    } catch (e) { n = Object.keys(UI.state.collected || {}).length; }
    return n;
  }

  function paintResetCopy() {
    var props = ownedCount();
    var coins = num(UI.state.coins, 0);
    var what = $('resetWhat');
    if (what) {
      txt(what, '會冇咗：' + props + ' 件收藏、' + coins + ' 蚊、成條故事線。' +
        '由 1972 年第一間舖重新開始，冇得返轉頭。');
    }
  }

  function paintResetIdle() {
    var b = $('settingsReset');
    if (!b) return;
    b.classList.remove('armed');
    b.setAttribute('aria-label', '重置進度');
    txt(b, '重置進度');
    txt($('resetHint'), '撳一次會問你，3 秒內再撳一次先會真係清。');
  }

  // Two-step: the first press only asks. If the second press does not land
  // within 3 s the button goes back to its idle self on its own.
  function disarmReset() {
    if (resetArmTimer) { clearTimeout(resetArmTimer); resetArmTimer = 0; }
    resetArmed = false;
    paintResetIdle();
  }

  function armReset() {
    var b = $('settingsReset');
    if (!b) return;
    if (!resetArmed) {
      resetArmed = true;
      b.classList.add('armed');
      b.setAttribute('aria-label', '真係重置？撳多次');
      txt(b, '真係重置？撳多次');
      txt($('resetHint'), '撳多次就會清走，3 秒之後自動取消。');
      focusLater(b);
      if (resetArmTimer) clearTimeout(resetArmTimer);
      resetArmTimer = setTimeout(disarmReset, RESET_ARM_MS);
      return;
    }
    // second press inside the window: this one is the real thing
    if (resetArmTimer) { clearTimeout(resetArmTimer); resetArmTimer = 0; }
    resetArmed = false;
    if (UI.onReset) UI.onReset();
    // main.js owns the wipe; the page only re-reads what it now owns.
    disarmReset();
    paintResetCopy();
    paintSound();
    txt($('resetHint'), '搞好喇。由 1972 年第一間舖重新開始。');
    UI.say('部機翻新咗。由頭嚟過。', 3600);
  }

  UI.openSettings = function () {
    // Settings is reached from the cabinet, so it takes over the screen rather
    // than stacking on it: two dialogs both claiming aria-modal is a lie to a
    // screen reader, and a 96% opaque sheet lets the one underneath ghost
    // through. The museum is put down here and picked back up on close.
    UI.settingsReturn = $('museumSettings');
    state.settingsFromMuseum = els.museum.classList.contains('on');
    if (state.settingsFromMuseum) els.museum.classList.remove('on');
    paintSound();
    paintResetCopy();
    disarmReset();
    els.settings.classList.add('on');
    setPageInert(true);
    if (els.settingsScroll) els.settingsScroll.scrollTop = 0;
    focusLater($('settingsClose'));
  };

  UI.closeSettings = function () {
    if (!els.settings.classList.contains('on')) return;
    disarmReset();
    els.settings.classList.remove('on');
    if (state.settingsFromMuseum) {
      // back to the cabinet, still inside the overlay, still inert page
      state.settingsFromMuseum = false;
      els.museum.classList.add('on');
      focusLater($('museumClose'));
      return;
    }
    setPageInert(false);
    if (UI.settingsReturn) focusLater(UI.settingsReturn);
    else if ($('museumBtn')) focusLater($('museumBtn'));
  };
  UI.isSettingsOpen = function () { return els.settings.classList.contains('on'); };

  function activeOverlay() {
    if (els.renew.classList.contains('on')) return els.renew;
    if (els.settings.classList.contains('on')) return els.settings;
    if (els.eras.classList.contains('on')) return els.eras;
    if (els.museum.classList.contains('on')) return els.museum;
    return null;
  }

  // While an overlay is up it is the only thing on screen, so the HUD, the
  // collect card and the other overlays must not be reachable by Tab or AT.
  // `inert` does that natively; the Tab wrap below covers older browsers.
  // The overlay that is open is never in this list (it would inert itself);
  // #museum and #settings are display:none while closed, so they are already
  // unreachable without help.
  var INERT_ROOTS = ['hud', 'card', 'start', 'done'];
  function setPageInert(on) {
    INERT_ROOTS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (on) {
        try { el.setAttribute('inert', ''); } catch (e) {}
        el.setAttribute('aria-hidden', 'true');
      } else {
        try { el.removeAttribute('inert'); } catch (e) {}
        el.removeAttribute('aria-hidden');
      }
    });
  }
  function focusables(root) {
    var list = root.querySelectorAll('button,[href],input,select,textarea,[tabindex]');
    return [].filter.call(list, function (el) {
      return el.tabIndex >= 0 && !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0;
    });
  }
  function trapTab(e) {
    if (e.key !== 'Tab') return;
    var ov = activeOverlay();
    if (!ov) return;
    var list = focusables(ov);
    if (!list.length) return;
    var i = list.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
    else if (!e.shiftKey && (i === list.length - 1 || i === -1)) { e.preventDefault(); list[0].focus(); }
  }

  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  // Focus after the overlay transition has actually started, not mid-click.
  function focusLater(el) {
    if (!el || !el.focus) return;
    setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} } }, 60);
  }

  // ── stage complete ─────────────────────────────────────────────────────
  // A round has to end out loud. The player just cleared a decade, so the page
  // says what the decade cost: what fell, what it paid, what was lost riding
  // the upper deck, and what was collected on the way. The numbers are read
  // from the sim's own stats, not recomputed here, so they cannot disagree
  // with the game that produced them.
  function paintDoneStats(stats) {
    var box = $('doneStats');
    if (!box) return;
    if (!stats) { box.hidden = true; box.innerHTML = ''; return; }
    var got = num(stats.got, 0), total = num(stats.total, 0);
    var cells = [
      { k: '跌出嚟', v: num(stats.drops, 0), cls: 'down' },
      { k: '收得返', v: num(stats.paid, 0), cls: 'up' },
      { k: '側溝食咗', v: num(stats.lost, 0), cls: 'down' },
      { k: '收藏', v: got + '/' + total, cls: 'up' }
    ];
    box.innerHTML = cells.map(function (c) {
      return '<div class="dsCol ' + c.cls + '"><div class="dsV">' + c.v +
        '</div><div class="dsK">' + c.k + '</div></div>';
    }).join('');
    box.hidden = false;
  }

  UI.showStageDone = function (stage, isLast, stats) {
    var yearEl = $('doneYear'), msgEl = $('doneMsg');
    var lineEl = $('doneLine'), beatEl = $('doneBeat');
    var s = story();
    var ending = (isLast && s && s.ending) ? s.ending : null;

    if (ending && (ending.line || ending.text)) {
      // The last card IS the ending: the tagline takes the year's place and the
      // closing text takes the generic 搞掂 line. Nothing extra to dismiss, so
      // the ending lands as the thing the player reads, not as a second modal.
      if (yearEl) yearEl.hidden = true;
      txt(lineEl, ending.line || '');
      if (lineEl) lineEl.hidden = !ending.line;
      txt(msgEl, ending.text || (stage && stage.done) || '');
      hide(beatEl);
      state.storySeen.ending = true;
    } else {
      if (yearEl) { yearEl.hidden = false; txt(yearEl, stage.year); }
      txt(msgEl, stage.done);
      hide(lineEl);
      // One beat, once per save: a stage that has already been read keeps its
      // plain done line, so the story never repeats itself on a replay.
      var beat = stage && beatFor(stage, state.stageIdx);
      if (beat && !state.storySeen[stage.id]) {
        txt(beatEl, beat.line || '');
        show(beatEl);
        markSeen(stage);
      } else hide(beatEl);
    }
    paintDoneStats(stats);

    $('doneNext').textContent = isLast ? '睇下機底' : '翻新部機';
    els.done.classList.add('on');
    UI.save();   // persist what was just read
  };

  // ── collect checklist ──────────────────────────────────────────────────
  UI.bigComplete = function (stage) {
    return stage.big.every(function (id) { return !!state.collected[id]; });
  };

  UI.save = function () {
    try {
      localStorage.setItem('yatmangai.save.v1', JSON.stringify({
        v: 1, stageIdx: state.stageIdx, coins: state.coins, collected: state.collected,
        seen: state.storySeen, maxStage: state.maxStage || 0,
        // a setting, not progress: 重置進度 must not switch the sound back on
        muted: muted
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
      state.storySeen = (s.seen && typeof s.seen === 'object') ? s.seen : {};
      // older saves have no `muted`; leave the default (on) in that case
      if (typeof s.muted === 'boolean') muted = s.muted;
      // Older saves carry no maxStage: the stage they were sitting on is the
      // furthest they had reached, so nothing they had opened is taken back.
      state.maxStage = Math.max(num(s.maxStage, 0), state.stageIdx);
      return true;
    } catch (e) { return false; }
  };

  // Paint the restored setting before anybody can open the page. boot() calls
  // this right after UI.load(), so a silent save never shows 開 for a frame.
  UI.paintSettings = function () { paintSound(); };

  G.UI = UI;
})(window);
