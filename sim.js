/* 一蚊雞 — sim.js
 * 2.5D coins-on-a-table simulation. No DOM, no three.js: testable in isolation.
 *
 * TWO DECKS. The player feeds the upper deck; its plate shoves coins over its
 * own lip and they cascade onto the lower deck, where a second plate (running
 * on a different period, so the two never sweep together) works the pile out
 * through the payout slot. Two tiers of the same 2.5D code, not two physics
 * engines: a coin carries `tier` and every routine reads its deck's bounds.
 *
 * Coordinate space: x right, z toward the player. A deck's lip is at z =
 * deck.table.lip. Real 3D integration is used only for the fall between decks
 * and for the payout drop, where it costs nothing and buys the whole payoff.
 */
(function (G) {
  'use strict';

  var COIN_R = 0.036, COIN_M = 1;
  var STEP = 1 / 120;

  var DECKS = {
    top: {
      key: 'top',
      y: 0.22,
      // The upper deck must BUFFER, not pipe. If the plate's forward extreme
      // reaches the lip, every coin it touches leaves immediately and the deck
      // drains to empty -- it becomes a conveyor. The stroke stops well short,
      // so a standing pile forms in front of it and only the leading edge
      // spills. That pile is the whole point of a second deck.
      // The upper deck sits over the REAR of the lower one. That is a geometry
      // constraint, not a styling choice: a coin landing past the lower plate's
      // forward extreme (z = 0.02) is never pushed again and never reaches the
      // lip either, so it jams the table solid. Landing around z = -0.11 keeps
      // every cascaded coin inside the lower plate's stroke.
      // Tuned in tools/_topsweep.mjs (240 s runs). The gap between the plate's
      // forward stop and the lip is the reservoir that makes the upper deck
      // read as "holding coins": fwd -0.33 / lip -0.15 keeps ~40 coins up top
      // while still cascading enough to feed the lower deck.
      table: { x0: -0.56, x1: 0.56, z0: -0.52, z1: -0.15, lip: -0.15 },
      plate: { back: -0.48, fwd: -0.33, period: 2.15 },
      dropZ: -0.36,
      // The upper deck pays nothing. Everything that leaves it lands below.
      payW: 0.56
    },
    bottom: {
      key: 'bottom',
      y: 0.0,
      table: { x0: -0.56, x1: 0.56, z0: -0.44, z1: 0.30, lip: 0.30 },
      plate: { back: -0.40, fwd: 0.02, period: 2.6 },
      dropZ: -0.20,
      // The payout slot, as a half-width in x. The table is 1.12 wide; this
      // slot is 0.56. Everything that leaves outside it is machine scrap.
      payW: 0.31,
      // In front of this line the side rails stop. A real pusher's front
      // corners are open: shove a coin sideways and it disappears into the
      // machine. Without this the lower deck has no drain -- every fed coin
      // stays, the pile jams solid against the plate, and the payout rate
      // collapses to nothing. It also gives wild aiming a real cost.
      gutterZ: 0.06
    }
  };
  var TOP = DECKS.top, BOT = DECKS.bottom;

  // legacy: the bottom deck is "the table" for anything that predates tiers
  var TABLE = BOT.table;
  var PLATE = BOT.plate;
  var DROP_Z = TOP.dropZ;
  var PAY_W = BOT.payW;

  // The room floor in front of the machine. There is no payout basin: a coin
  // that leaves the lower deck falls down the front of the cabinet and stops
  // here, on the same plane the room floor is drawn on in render.js buildRoom()
  // (floor.position.y = -0.42). The floor is the destination, not a tray.
  var FLOOR_Y = -0.42;
  // A landed coin lies on the floor this long so the payout registers, then it
  // is gone. The floor is not a shelf, and lingering clutter reads as a bug.
  var TRAY_DWELL = 0.9;
  var TRAY_FADE = 0.5;
  var MAX_TRAY = 18;
  var MAX_COINS = 480, MAX_LAYER = 12;

  // Gravity for the inter-deck cascade and the payout drop.
  var GRAV = 3.6;

  // Portion of a coin's sideways offset that survives the drop between decks.
  // The scoop under the upper lip necks the feed toward the centre; a coin
  // leaving the upper edge at x = 0.5 lands near x = 0.2.
  var SCOOP = 0.40;

  // Friction, as a per-second decay rate. Coins slide a good distance and stop;
  // props are heavy and grab the felt quickly. This is what lets one stroke
  // shove a whole row instead of nudging a single disc 2 cm.
  var MU_COIN = 2.1, MU_PROP = 4.5;

  // ── deterministic RNG (mulberry32) ─────────────────────────────────────
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── uniform grid for neighbour queries ─────────────────────────────────
  function Grid(cell) {
    this.cell = cell; this.map = new Map(); this.mark = 0;
  }
  Grid.prototype.clear = function () { this.map.clear(); };
  Grid.prototype.key = function (cx, cz) { return cx * 4096 + cz; };
  Grid.prototype.insert = function (c) {
    var k = this.cell, c0 = Math.floor((c.x - c.r) / k), c1 = Math.floor((c.x + c.r) / k);
    var z0 = Math.floor((c.z - c.r) / k), z1 = Math.floor((c.z + c.r) / k);
    for (var ix = c0; ix <= c1; ix++) for (var iz = z0; iz <= z1; iz++) {
      var key = this.key(ix, iz), b = this.map.get(key);
      if (!b) { b = []; this.map.set(key, b); }
      b.push(c);
    }
  };
  // A coin can sit in several cells, so results need de-duplicating. A stamp
  // beats indexOf here: query() runs ~1200x per step and the list is long
  // enough that the O(k^2) scan dominated the whole simulation.
  Grid.prototype.query = function (x, z, out) {
    out.length = 0;
    var k = this.cell, cx = Math.floor(x / k), cz = Math.floor(z / k);
    var mark = ++this.mark;
    for (var ix = cx - 1; ix <= cx + 1; ix++) for (var iz = cz - 1; iz <= cz + 1; iz++) {
      var b = this.map.get(this.key(ix, iz));
      if (!b) continue;
      for (var i = 0; i < b.length; i++) {
        var c = b[i];
        if (c._q === mark) continue;
        c._q = mark;
        out.push(c);
      }
    }
    return out;
  };

  function blankStats() {
    return { dropped: 0, paid: 0, bigPaid: 0, lost: 0, shuttled: 0, maxLayer: 0 };
  }

  // ── state ──────────────────────────────────────────────────────────────
  var Sim = {
    coins: [],        // on either table
    fall: [],         // in true-3D freefall: inter-deck cascade or payout drop
    nextId: 1,
    t: 0,
    front: { top: TOP.plate.back, bottom: BOT.plate.back },
    vel: { top: 0, bottom: 0 },
    rng: makeRng(1),
    stats: blankStats(),
    onPayout: null,   // fn(coin)
    onBigPayout: null,
    onLost: null,
    onShuttle: null,  // fn(coin) — a coin just left the upper deck
    busy: false,      // a collect card is open; hold the world still

    grid: new Grid(0.11),
    _q: [],

    // Test seam: let tools re-shape a deck before reset() so geometry sweeps
    // run against the same code path the game uses.
    setDeck: function (tier, patch) {
      var d = DECKS[tier];
      if (!d || !patch) return;
      if (patch.lip != null) { d.table.lip = patch.lip; d.table.z1 = patch.lip; }
      if (patch.fwd != null) d.plate.fwd = patch.fwd;
      if (patch.back != null) d.plate.back = patch.back;
      if (patch.period != null) d.plate.period = patch.period;
      if (patch.payW != null) d.payW = patch.payW;
      if (patch.scoop != null) SCOOP = patch.scoop;
    },

    reset: function (seed) {
      this.coins.length = 0; this.fall.length = 0;
      this.nextId = 1; this.t = 0;
      this.front = { top: TOP.plate.back, bottom: BOT.plate.back };
      this.vel = { top: 0, bottom: 0 };
      this.rng = makeRng(seed == null ? 1 : seed);
      // Park each plate exactly where its phase clock says it should be at
      // t = 0, so the first step is a continuation rather than a jump.
      this._parkPlates();
      this.stats = blankStats();
      this.busy = false;
      if (this.payW == null) this.payW = PAY_W;
    },

    _parkPlates: function () {
      var self = this;
      ['top', 'bottom'].forEach(function (tier) {
        var P = DECKS[tier].plate;
        var phase = tier === 'bottom' ? 0.85 : 0;
        var ph = ((self.t + phase) % P.period) / P.period;
        var s = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
        self.front[tier] = P.back + (P.fwd - P.back) * s;
      });
    },

    // Place a coin on a deck. kind: 'coin' | 'prop'
    spawn: function (x, z, kind, propId, tier) {
      if (this.coins.length >= MAX_COINS) this._retireOldest();
      var def = kind === 'prop' ? G.CONTENT.PROPS[propId] : null;
      var r = def ? (def.radius || 0.11) : COIN_R;
      var m = def ? (def.weight || 2) : COIN_M;
      var c = {
        id: this.nextId++, x: x, z: z, l: 0, cy: 0.6,          // cy = visual y, eases to l*h
        vx: 0, vz: 0, r: r, m: m, im: 1 / m,
        kind: kind, prop: propId || null, ax: 0, az: 0,          // ax/az = render-only tumble
        fallT: 0.26,                                               // landing animation
        state: 'table', tier: tier || 'bottom', _q: 0
      };
      this.coins.push(c);
      return c;
    },

    // The player's coin always enters the upper deck.
    drop: function (x) {
      var t = TOP.table;
      var z = Math.max(TOP.dropZ, this.front.top + COIN_R + 0.004);
      z = Math.min(z, t.lip - COIN_R);
      var c = this.spawn(clamp(x, t.x0 + COIN_R, t.x1 - COIN_R), z, 'coin', null, 'top');
      c.fallT = 0.30;
      c.cy = TOP.y + 0.26;
      this.stats.dropped++;
      return c;
    },

    _retireOldest: function () {
      // Keep the pile playable: the deepest, oldest layer-0 coin leaves quietly.
      var best = -1, bestZ = -1e9;
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        if (c.l === 0 && c.z > bestZ && c.kind === 'coin') { bestZ = c.z; best = i; }
      }
      if (best >= 0) this.coins.splice(best, 1);
    },

    // Scatter a believable starting pile. Both decks, because a machine that
    // has been on a shop floor since 1972 is never sold empty.
    seedPile: function (n) {
      var rnd = this.rng;
      // The upper deck is the one the player reads first, so it must be
      // visibly stocked at stage start; the lower deck fills itself.
      var bottomN = Math.round(n * 0.46);
      for (var i = 0; i < n; i++) {
        var top = i >= bottomN;
        var dk = top ? TOP : BOT;
        var t = dk.table;
        var zLo = top ? t.z0 + 0.04 : -0.16;
        var zHi = top ? t.lip - 0.07 : 0.14;
        var x = t.x0 + 0.05 + rnd() * (t.x1 - t.x0 - 0.10);
        var z = zLo + rnd() * (zHi - zLo);
        var c = this.spawn(x, z, 'coin', null, top ? 'top' : 'bottom');
        c.cy = 0;
        c.fallT = 0;
        c.vx = (rnd() - 0.5) * 0.05;
        c.vz = (rnd() - 0.5) * 0.05;
      }
      this._recomputeLayers();
    },

    // ── one fixed step ───────────────────────────────────────────────────
    step: function (dt) {
      if (this.busy) { this._animateOnly(dt); return; }
      this.t += dt;

      this._sweep('top', dt, 0);
      this._sweep('bottom', dt, 0.85);

      this._recomputeLayers();
      this._move(dt);
      this._collide();
      this._plate('top');
      this._plate('bottom');
      this._walls();
      this._payout();
      this._animateOnly(dt);
    },

    _sweep: function (tier, dt, phase) {
      var P = DECKS[tier].plate;
      var ph = ((this.t + phase) % P.period) / P.period;
      var s = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
      var prev = this.front[tier];
      this.front[tier] = P.back + (P.fwd - P.back) * s;
      // The stroke has a known top speed: d/dph of the cosine ease is PI, so
      // |v| <= |fwd - back| * PI / period. Anything above that can only come
      // from a discontinuity -- reset() dropping `front` back to its rest
      // position while the phase clock keeps running -- and a phantom stroke
      // of tens of m/s is enough to fire the whole seeded pile off the table
      // and send payout coins to z = 17. Clamp it at the physical bound.
      var vmax = Math.abs(P.fwd - P.back) * Math.PI / P.period * 1.5;
      var v = (this.front[tier] - prev) / dt;
      this.vel[tier] = v > vmax ? vmax : v < -vmax ? -vmax : v;
    },

    _animateOnly: function (dt) {
      // visual settle: cy eases toward the layer height
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        var target = DECKS[c.tier].y + c.l * 0.0132;
        c.cy += (target - c.cy) * Math.min(1, dt * 14);
        if (c.fallT > 0) c.fallT -= dt;
        c.ax *= 0.90; c.az *= 0.90;
        if (c.l > this.stats.maxLayer) this.stats.maxLayer = c.l;
      }
    },

    _recomputeLayers: function () {
      var g = this.grid, coins = this.coins, q = this._q;
      g.clear();
      for (var i = 0; i < coins.length; i++) g.insert(coins[i]);

      for (var i2 = 0; i2 < coins.length; i2++) {
        var c = coins[i2];
        g.query(c.x, c.z, q);
        var L = 0, guard = 0;
        while (true) {
          var blocked = false;
          for (var j = 0; j < q.length; j++) {
            var o = q[j];
            if (o === c || o.l !== L || o.tier !== c.tier) continue;
            var dx = o.x - c.x, dz = o.z - c.z;
            var lim = (c.r + o.r) * 0.74;
            if (dx * dx + dz * dz < lim * lim) { blocked = true; break; }
          }
          if (!blocked) break;
          if (++L > MAX_LAYER) { L = MAX_LAYER; break; }
          if (++guard > MAX_LAYER + 1) break;
        }
        c.l = L;
      }
    },

    _move: function (dt) {
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        if (c.fallT > 0) {
          // still dropping from the chute: it rides the plate, it does not collide
          c.x += c.vx * dt * 0.2;
          if (c.z < this.front[c.tier] + c.r) c.z = this.front[c.tier] + c.r;
          c.vx *= 0.9; c.vz = 0;
          continue;
        }
        c.x += c.vx * dt;
        c.z += c.vz * dt;
        // exponential decay, framed in seconds so the feel does not depend on
        // the step size: v *= 0.87 each 1/120 s was 10^7 x per second.
        var k = Math.exp(-(c.kind === 'prop' ? MU_PROP : MU_COIN) * dt);
        c.vx *= k; c.vz *= k;
        if (Math.abs(c.vx) < 1e-4) c.vx = 0;
        if (Math.abs(c.vz) < 1e-4) c.vz = 0;
      }
    },

    _collide: function () {
      var q = this._q, g = this.grid, coins = this.coins, it, i, j;

      for (it = 0; it < 3; it++) {
        for (i = 0; i < coins.length; i++) {
          var a = coins[i];
          if (a.fallT > 0) continue;
          g.query(a.x, a.z, q);
          for (j = 0; j < q.length; j++) {
            var b = q[j];
            if (b.id <= a.id || b.fallT > 0) continue;
            if (b.tier !== a.tier) continue;   // the two decks are separate worlds
            var dx = b.x - a.x, dz = b.z - a.z;
            var d2 = dx * dx + dz * dz;
            var rr = a.r + b.r;

            if (a.l !== b.l) {
              // Stacked coins DO overlap in plan view -- that overlap is what
              // makes a coin count as being on the layer above. So they must
              // not be pushed apart here; instead a stack moves as one mass,
              // sharing forward motion. Without this the pile above the plate
              // sheared off and never carried a stroke across the table.
              var rr2 = rr * 0.86;
              if (d2 >= rr2 * rr2 || d2 < 1e-9) continue;
              var ma = 1 / a.im, mb = 1 / b.im, msum = ma + mb;
              var vm = (a.vz * ma + b.vz * mb) / msum;
              a.vz = a.vz * 0.45 + vm * 0.55;
              b.vz = b.vz * 0.45 + vm * 0.55;
              continue;
            }

            if (d2 >= rr * rr || d2 < 1e-9) continue;
            var d = Math.sqrt(d2), ov = rr - d;
            var nx = dx / d, nz = dz / d;
            var tot = a.im + b.im;
            var pa = (a.im / tot) * ov, pb = (b.im / tot) * ov;
            a.x -= nx * pa; a.z -= nz * pa;
            b.x += nx * pb; b.z += nz * pb;
            // a little momentum transfer so piles shove instead of just slide
            var rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (rel < 0) {
              var imp = -rel * 0.55;
              a.vx -= nx * imp * (a.im / tot) * 2; a.vz -= nz * imp * (a.im / tot) * 2;
              b.vx += nx * imp * (b.im / tot) * 2; b.vz += nz * imp * (b.im / tot) * 2;
            }
          }
        }
      }
    },

    _plate: function (tier) {
      var face = this.front[tier], vel = this.vel[tier];
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        if (c.tier !== tier) continue;
        // Only what is in front of the face is pushed. A coin behind the plate
        // is behind it — the sweep must not reach through the steel.
        if (c.z < face) continue;
        var over = (face + c.r) - c.z;
        if (over > 0) {
          c.z += over;
          if (vel > 0 && c.vz < vel) c.vz = vel > 1.0 ? 1.0 : vel;
        }
      }
    },

    _walls: function () {
      for (var i = this.coins.length - 1; i >= 0; i--) {
        var c = this.coins[i], dk = DECKS[c.tier], t = dk.table;
        if (c.z - c.r < t.z0) { c.z = t.z0 + c.r; c.vz = Math.abs(c.vz) * 0.3; }

        // Front corners are open on the paying deck: a coin shoved past the
        // side edge in that zone tips into the machine and is gone.
        if (dk.gutterZ != null && c.z > dk.gutterZ &&
            (c.x - c.r * 0.5 < t.x0 || c.x + c.r * 0.5 > t.x1)) {
          if (c.kind === 'prop') { c.x = clamp(c.x, t.x0 + c.r, t.x1 - c.r); }
          else { this._scrap(c); continue; }
        }

        if (c.x - c.r < t.x0) { c.x = t.x0 + c.r; c.vx = Math.abs(c.vx) * 0.35; }
        if (c.x + c.r > t.x1) { c.x = t.x1 - c.r; c.vx = -Math.abs(c.vx) * 0.35; }
      }
    },

    // A coin that leaves the table without paying. Same downstream treatment
    // as a coin outside the payout slot: it falls out of sight and is gone.
    _scrap: function (c) {
      var i = this.coins.indexOf(c);
      if (i < 0) return;
      this.coins.splice(i, 1);
      var dk = DECKS[c.tier];
      c.fx = c.x; c.fz = c.z; c.fy = dk.y + c.l * 0.0132;
      c.fvx = c.vx * 1.4; c.fvz = c.vz * 0.6; c.fvy = 0.02;
      c.fax = (this.rng() - 0.5) * 9; c.faz = (this.rng() - 0.5) * 9;
      c.age = 0; c.state = 'lost';
      this.fall.push(c);
      this.stats.lost++;
      if (this.onLost) this.onLost(c);
    },

    // Cross the lip.
    //   upper deck  -> the coin tumbles down onto the lower deck
    //   lower deck  -> payout (inside the slot) or scrap (outside it)
    // The slot is narrower than the table. That is the house edge of a real
    // pusher, and the reason aiming matters.
    _payout: function () {
      for (var i = this.coins.length - 1; i >= 0; i--) {
        var c = this.coins[i];
        if (c.fallT > 0) continue;
        var dk = DECKS[c.tier];
        if (!(c.z - c.r * 0.15 > dk.table.lip)) continue;

        this.coins.splice(i, 1);
        c.fx = c.x;
        c.fz = c.z;
        c.fy = dk.y + c.l * 0.0132;
        c.fvy = 0.10;
        c.fax = (this.rng() - 0.5) * 9;
        c.faz = (this.rng() - 0.5) * 9;
        c.age = 0;

        if (c.tier === 'top') {
          // Cascade. The scoop under the upper lip necks down, so a coin that
          // leaves at the far edge still lands near the middle of the paying
          // deck. Without the funnel, aiming left/right on the top deck decided
          // the payout almost entirely by itself and wild aiming went to zero
          // return -- one decision, doubled, with the second one invisible.
          c.state = 'shuttle';
          c.fvz = Math.min(0.42, Math.max(c.vz * 0.45, 0.10));
          c.fvx = (c.x * (SCOOP - 1) + c.vx * 0.22) / 1.0;
          this.fall.push(c);
          this.stats.shuttled++;
          if (this.onShuttle) this.onShuttle(c);
          continue;
        }

        // A prop is tall enough to tumble over the lip anywhere; a coin has to
        // go through the slot. Losing a prize you spent minutes pushing would
        // just be cruel.
        var paid = c.kind === 'prop' || Math.abs(c.x) <= this.payW;
        c.state = paid ? 'falling' : 'lost';
        c.fvz = clamp(Math.max(c.vz, 0.22) + 0.12, 0.10, 0.90);
        c.fvx = clamp(c.vx, -0.60, 0.60);
        this.fall.push(c);

        if (!paid) {
          this.stats.lost++;
          if (this.onLost) this.onLost(c);
        } else if (c.kind === 'prop') {
          this.stats.bigPaid++;
          if (this.onBigPayout) this.onBigPayout(c);
        } else {
          this.stats.paid++;
          if (this.onPayout) this.onPayout(c);
        }
      }
    },

    // Hand a cascaded coin back into the simulation on the lower deck. It must
    // land in front of the lower plate's face, exactly like a dropped coin, or
    // it spends half a sweep buried inside the steel.
    _land: function (fc) {
      if (this.coins.length >= MAX_COINS) this._retireOldest();
      var t = BOT.table, r = fc.r;
      var z = clamp(fc.fz, t.z0 + r, t.lip - 0.05);
      var floorZ = this.front.bottom + r + 0.004;
      if (z < floorZ) z = Math.min(t.lip - 0.05, floorZ);
      var c = {
        id: this.nextId++, x: clamp(fc.fx, t.x0 + r, t.x1 - r), z: z,
        l: 0, cy: BOT.y + 0.26, vx: fc.fvx * 0.55, vz: Math.max(fc.fvz * 0.45, 0.02),
        r: r, m: fc.m, im: fc.im, kind: fc.kind, prop: fc.prop,
        ax: fc.fax * 0.3, az: fc.faz * 0.3, fallT: 0.24,
        state: 'table', tier: 'bottom', _q: 0
      };
      this.coins.push(c);
      return c;
    },

    // freefall integration, called with real dt from the render loop.
    stepFall: function (dt) {
      // Trim the coins on their way down BEFORE the pass: shifting inside a
      // reverse loop skips the coin that slid into the vacated slot and
      // integrates it twice. Nothing lands in a tray any more, but a burst of
      // payouts still must not spawn an unbounded number of shadow casters.
      var paidFalling = 0;
      for (var p = 0; p < this.fall.length; p++) {
        if (this.fall[p].state === 'falling') paidFalling++;
      }
      while (paidFalling > MAX_TRAY) {
        for (var s2 = 0; s2 < this.fall.length; s2++) {
          if (this.fall[s2].state === 'falling') { this.fall.splice(s2, 1); break; }
        }
        paidFalling--;
      }
      for (var i = this.fall.length - 1; i >= 0; i--) {
        var c = this.fall[i];
        c.age = (c.age || 0) + dt;
        c.fvy -= GRAV * dt;
        c.fy += c.fvy * dt;
        c.fz += c.fvz * dt;
        c.fx += c.fvx * dt;
        c.fax += c.fvy * 0.4;

        if (c.state === 'shuttle') {
          if (c.fy <= BOT.y + 0.004) { this._land(c); this.fall.splice(i, 1); }
          continue;
        }

        // Once a coin is over the front edge there is nothing to catch it: paid
        // and lost coins both ride the same arc all the way down to the room
        // floor, sit there for the dwell so the player sees where it went, then
        // are gone. Nothing stops at the old tray height any more.
        if (c.fy <= FLOOR_Y) {
          c.fy = FLOOR_Y;
          if (c.fvy < 0) c.fvy = 0;
          c.fvx *= 0.82; c.fvz *= 0.82;
          c.fax *= 0.86;
        }
        if (c.age > TRAY_DWELL) this.fall.splice(i, 1);
      }
    },

    layerHistogram: function () {
      var h = new Array(MAX_LAYER + 1).fill(0);
      for (var i = 0; i < this.coins.length; i++) h[Math.min(this.coins[i].l, MAX_LAYER)]++;
      return h;
    },

    countTier: function (tier) {
      var n = 0;
      for (var i = 0; i < this.coins.length; i++) if (this.coins[i].tier === tier) n++;
      return n;
    },

    countProps: function () {
      var n = 0;
      for (var i = 0; i < this.coins.length; i++) if (this.coins[i].kind === 'prop') n++;
      return n;
    },

    hasProp: function (id) {
      for (var i = 0; i < this.coins.length; i++)
        if (this.coins[i].prop === id) return true;
      return false;
    }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // A fresh, independent instance. The selftest needs these: Object.create(Sim)
  // would share the prototype's grid and corrupt the live simulation.
  Sim.create = function () {
    var s = Object.create(Sim);
    s.coins = []; s.fall = []; s.grid = new Grid(0.11); s._q = [];
    s.nextId = 1; s.t = 0;
    s.front = { top: TOP.plate.back, bottom: BOT.plate.back };
    s.vel = { top: 0, bottom: 0 };
    s.rng = makeRng(1); s.busy = false;
    s.stats = blankStats();
    s._parkPlates();
    s.onPayout = null; s.onBigPayout = null; s.onLost = null; s.onShuttle = null;
    return s;
  };

  Sim.COIN_R = COIN_R; Sim.STEP = STEP;
  Sim.MAX_COINS = MAX_COINS; Sim.MAX_LAYER = MAX_LAYER;
  Sim.DECKS = DECKS; Sim.TOP = TOP; Sim.BOTTOM = BOT;
  Sim.TABLE = TABLE; Sim.PLATE = PLATE;
  // FLOOR_Y is the real destination. TRAY_Y stays exported as an alias so the
  // older tools (viewprobe, the probe()) and render code keep resolving, but
  // nothing lands on a tray any more.
  Sim.DROP_Z = DROP_Z; Sim.FLOOR_Y = FLOOR_Y; Sim.TRAY_Y = FLOOR_Y;
  Sim.TRAY_DWELL = TRAY_DWELL; Sim.TRAY_FADE = TRAY_FADE;
  Sim.PAY_W = PAY_W; Sim.GRAV = GRAV;
  Sim.makeRng = makeRng;
  Sim.clamp = clamp;
  G.Sim = Sim;
})(window);
