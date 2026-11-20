/* 一蚊雞 — sim.js
 * 2.5D coins-on-a-table simulation. No DOM, no three.js: testable in isolation.
 *
 * Coordinate space: x right, z toward the player. The lip is at z = TABLE.lip.
 * Coins are discs in (x, z) with an integer layer. Real 3D physics is used only
 * for the payout fall, where it costs nothing and buys the whole payoff.
 */
(function (G) {
  'use strict';

  var COIN_R = 0.036, COIN_M = 1;
  var TABLE = { x0: -0.56, x1: 0.56, z0: -0.44, z1: 0.30, lip: 0.30 };
  // The plate must travel far enough that the pile it compresses actually
  // reaches the lip. With fwd at -0.10 the last 0.40 of table was unreachable
  // by direct push, so nothing ever paid out.
  var PLATE = { back: -0.40, fwd: 0.02, period: 2.6 };
  var DROP_Z = -0.20;
  // top of the tray floor: a paid coin comes to rest here, not through it
  var TRAY_Y = -0.081;
  // a paid coin rests in the tray this long, so the pile visibly grows
  var TRAY_DWELL = 6.0;
  var MAX_TRAY = 26;
  var MAX_COINS = 480, MAX_LAYER = 12;
  var STEP = 1 / 120;

  // The payout slot, as a half-width in x. The table is 1.12 wide; this slot
  // is 0.72. Everything that leaves outside it is machine scrap, not money.
  var PAY_W = 0.28;

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

  // ── state ──────────────────────────────────────────────────────────────
  var Sim = {
    coins: [],        // on the table
    fall: [],         // in true-3D freefall after crossing the lip
    nextId: 1,
    t: 0,
    plateFront: PLATE.back,
    plateVel: 0,
    rng: makeRng(1),
    stats: { dropped: 0, paid: 0, bigPaid: 0, lost: 0, maxLayer: 0 },
    onPayout: null,   // fn(coin)
    onBigPayout: null,
    busy: false,      // a collect card is open; hold the world still

    grid: new Grid(0.11),
    _q: [],

    reset: function (seed) {
      this.coins.length = 0; this.fall.length = 0;
      this.nextId = 1; this.t = 0;
      this.plateFront = PLATE.back; this.plateVel = 0;
      this.rng = makeRng(seed == null ? 1 : seed);
      this.stats = { dropped: 0, paid: 0, bigPaid: 0, lost: 0, maxLayer: 0 };
      this.busy = false;
      if (this.payW == null) this.payW = PAY_W;
    },

    // Place a coin on the table. kind: 'coin' | 'prop'
    spawn: function (x, z, kind, propId) {
      if (this.coins.length >= MAX_COINS) this._retireOldest();
      var def = kind === 'prop' ? G.CONTENT.PROPS[propId] : null;
      var r = def ? (def.radius || 0.11) : COIN_R;
      var m = def ? (def.weight || 2) : COIN_M;
      var c = {
        id: this.nextId++, x: x, z: z, l: 0, cy: 0.6,          // cy = visual y, eases to l*h
        vx: 0, vz: 0, r: r, m: m, im: 1 / m,
        kind: kind, prop: propId || null, ax: 0, az: 0,          // ax/az = render-only tumble
        fallT: 0.26,                                               // landing animation
        state: 'table', _q: 0
      };
      this.coins.push(c);
      return c;
    },

    drop: function (x) {
      var z = Math.max(DROP_Z, this.plateFront + COIN_R + 0.004);
      var c = this.spawn(clamp(x, TABLE.x0 + COIN_R, TABLE.x1 - COIN_R), z, 'coin');
      c.fallT = 0.30;
      c.cy = 0.55;
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

    // Scatter a believable starting pile.
    seedPile: function (n) {
      var rnd = this.rng;
      for (var i = 0; i < n; i++) {
        var x = TABLE.x0 + 0.05 + rnd() * (TABLE.x1 - TABLE.x0 - 0.10);
        var z = -0.16 + rnd() * 0.30;
        var c = this.spawn(x, z, 'coin');
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

      // plate: smooth sweep, back -> forward -> back
      var ph = (this.t % PLATE.period) / PLATE.period;          // 0..1
      var s = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);           // 0..1..0
      var prev = this.plateFront;
      this.plateFront = PLATE.back + (PLATE.fwd - PLATE.back) * s;
      this.plateVel = (this.plateFront - prev) / dt;

      this._recomputeLayers();
      this._move(dt);
      this._collide();
      this._plate();
      this._walls();
      this._payout();
      this._animateOnly(dt);
    },

    _animateOnly: function (dt) {
      // visual settle: cy eases toward the layer height
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        var target = c.l * 0.0132;
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
            if (o === c || o.l !== L) continue;
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
          if (c.z < this.plateFront + c.r) c.z = this.plateFront + c.r;
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

    _plate: function () {
      var face = this.plateFront;
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        // Only what is in front of the face is pushed. A coin behind the plate
        // is behind it — the sweep must not reach through the steel.
        if (c.z < face) continue;
        var over = (face + c.r) - c.z;
        if (over > 0) {
          c.z += over;
          if (this.plateVel > 0 && c.vz < this.plateVel) c.vz = this.plateVel;
        }
      }
    },

    _walls: function () {
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        if (c.x - c.r < TABLE.x0) { c.x = TABLE.x0 + c.r; c.vx = Math.abs(c.vx) * 0.35; }
        if (c.x + c.r > TABLE.x1) { c.x = TABLE.x1 - c.r; c.vx = -Math.abs(c.vx) * 0.35; }
        if (c.z - c.r < TABLE.z0) { c.z = TABLE.z0 + c.r; c.vz = Math.abs(c.vz) * 0.3; }
      }
    },

    // Cross the lip -> hand off to the true-3D integrator.
    // The payout slot is narrower than the table. A coin that crosses the lip
    // outside it drops into the machine's own return tray and is gone -- that
    // is the house edge of a real pusher, and the reason aiming matters.
    _payout: function () {
      for (var i = this.coins.length - 1; i >= 0; i--) {
        var c = this.coins[i];
        if (c.fallT > 0) continue;
        if (c.z - c.r * 0.15 > TABLE.lip) {
          this.coins.splice(i, 1);
          // A prop is tall enough to tumble over the lip anywhere; a coin has
          // to go through the slot. Losing a prize you spent minutes pushing
          // would just be cruel.
          var paid = c.kind === 'prop' || Math.abs(c.x) <= this.payW;
          c.state = paid ? 'falling' : 'lost';
          // stepFall() integrates fx/fz, so seed them from the live position
          // the coin had when it crossed the lip. Without this the first
          // fall step adds to undefined and the mesh goes to NaN.
          c.fx = c.x;
          c.fz = c.z;
          c.fy = c.l * 0.0132;
          c.fvy = 0.10;
          c.fvz = Math.max(c.vz, 0.22) + 0.12;
          c.fvx = c.vx;
          c.fax = (this.rng() - 0.5) * 9;
          c.faz = (this.rng() - 0.5) * 9;
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
      }
    },

    // freefall integration, called with real dt from the render loop.
    // A paid coin now lands in the tray and sits there for a beat so the
    // player actually sees the thing they won; a coin outside the payout slot
    // drops past the machine and is gone.
    stepFall: function (dt) {
      for (var i = this.fall.length - 1; i >= 0; i--) {
        var c = this.fall[i];
        c.age = (c.age || 0) + dt;
        c.fvy -= 2.6 * dt;
        c.fy += c.fvy * dt;
        c.fz += c.fvz * dt;
        c.fx += c.fvx * dt;
        c.fax += c.fvy * 0.4;

        if (c.state === 'falling') {
          // tray floor: stop, then fade out
          if (c.fy <= TRAY_Y) {
            c.fy = TRAY_Y;
            c.fvy = 0;
            c.fvx *= 0.82; c.fvz *= 0.82;
            c.fax *= 0.86;
          }
          // Dwell long enough that the tray reads as accumulating winnings
          // rather than as a brief animation, but do not grow without bound.
          if (this.fall.length > MAX_TRAY) this.fall.shift();
          if (c.age > TRAY_DWELL) this.fall.splice(i, 1);
        } else if (c.fy < -0.55) {
          this.fall.splice(i, 1);
        }
      }
    },

    layerHistogram: function () {
      var h = new Array(MAX_LAYER + 1).fill(0);
      for (var i = 0; i < this.coins.length; i++) h[Math.min(this.coins[i].l, MAX_LAYER)]++;
      return h;
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
    s.nextId = 1; s.t = 0; s.plateFront = PLATE.back; s.plateVel = 0;
    s.rng = makeRng(1); s.busy = false;
    s.stats = { dropped: 0, paid: 0, bigPaid: 0, lost: 0, maxLayer: 0 };
    s.onPayout = null; s.onBigPayout = null;
    return s;
  };

  Sim.COIN_R = COIN_R; Sim.TABLE = TABLE; Sim.PLATE = PLATE;
  Sim.DROP_Z = DROP_Z; Sim.TRAY_Y = TRAY_Y; Sim.TRAY_DWELL = TRAY_DWELL; Sim.STEP = STEP; Sim.MAX_COINS = MAX_COINS;
  Sim.PAY_W = PAY_W; Sim.TABLE = TABLE; Sim.PLATE = PLATE;
  Sim.MAX_LAYER = MAX_LAYER; Sim.makeRng = makeRng;
  Sim.clamp = clamp;
  G.Sim = Sim;
})(window);
