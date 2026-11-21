/* 一蚊雞 — sim.js
 * 2.5D coins-on-a-table simulation. No DOM, no three.js: testable in isolation.
 *
 * ONE DECK, ONE SLIDING PLATE.
 *
 * The machine has a single felt bed and one steel plate that slides across it.
 * The plate is a raised shelf, PLATE_DROP proud of the felt, spanning from the
 * back wall out to its leading rib. That slab is the whole reason for the
 * shape: a dropped coin visibly LANDS ON THE BAR and is carried by it, instead
 * of sitting on inert felt until a metre of pile crushes it forward.
 *
 * The plate carries a coin forward by only RIDE of the stroke and does not drag
 * it back on the return, so each cycle the coin slides forward relative to the
 * rib. Within about one cycle it clears the retracted rib position, at which
 * point it is on the felt in front of the plate and the rib shoves it like any
 * other coin. RIDE < 1 is what stops the plate from being a conveyor that
 * needs no feeding at all.
 *
 * The plate's forward stop is well short of the lip on purpose. The band
 * between them is the reservoir: coins there are moved only by their
 * neighbours, which is exactly how a real pusher transfers a stroke across a
 * pile instead of firing coins off the table.
 *
 * Coordinate space: x right, z toward the player. The lip is at z =
 * DECK.table.lip. True 3D integration is used only for the payout drop, where
 * it costs nothing and buys the whole payoff.
 */
(function (G) {
  'use strict';

  var COIN_R = 0.036, COIN_M = 1;
  var STEP = 1 / 120;

  // One deck, wide enough that the pile can spread sideways and deep enough
  // that a coin must be shoved several times before it reaches the lip.
  var DECK = {
    key: 'main',
    y: 0,
    table: { x0: -0.62, x1: 0.62, z0: -0.52, z1: 0.32, lip: 0.28 },
    // The plate's stroke, as the z of its leading rib. `back` must stay in
    // front of dropZ so a dropped coin lands on the slab; `fwd` must stay well
    // behind the lip or the plate itself would sweep coins straight into the
    // slot and the reservoir would disappear.
    // `fwd` and `lip` are measured, not guessed. A rib that reaches the lip
    // pins the return rate at 1.00 (the plate becomes a conveyor); a gap of
    // 0.32 -- four coin diameters -- turns out to be too wide in a different
    // way, because a prize crossing `front + r` can then only be moved by the
    // weight of coins behind it, so a prize out near the rail never moves
    // again (measured 1-3 payouts out of 8). The 0.24 gap below keeps real
    // pile pressure in play: centre aim pays ~0.89, a half-slot aim ~0.64,
    // aim past the edge ~0.18.
    plate: { back: -0.20, fwd: 0.04, period: 2.4 },
    dropZ: -0.30,
    // The payout slot, as a half-width in x. The table is 1.24 wide, so this is
    // a third of it. Measured: p90 of the x of a coin crossing the lip is only
    // 0.15, because a heap funnels itself down the middle on the way out -- so
    // a slot much wider than this swallows nearly everything that arrives and
    // the wallet never moves. Narrowing it further than 0.20 buys a steeper
    // aiming penalty but starves the prizes of the budget they need.
    payW: 0.20,
    // In front of this line the rails stop: a coin shoved past the side edge
    // here tips into the machine and is gone. That is a real pusher's open
    // front corner, and without it the deck has no drain -- the pile jams
    // solid against the rib and the payout rate collapses.
    gutterZ: 0.10,
    // How far the plate stands proud of the felt. Not decoration: it is what
    // makes a carried coin read as lying ON the bar, and what makes the rib a
    // wall rather than a paint stripe.
    plateDrop: 0.016
  };
  var DECKS = { main: DECK };
  // Compat aliases: older tools and the probe still ask for TOP / BOTTOM.
  var TOP = DECK, BOT = DECK;
  var TABLE = DECK.table, PLATE = DECK.plate;
  var DROP_Z = DECK.dropZ, PAY_W = DECK.payW;
  var PLATE_DROP = DECK.plateDrop;

  // Fraction of the forward stroke a coin standing on the plate is carried by.
  // See the header: below 1 the coin slides forward relative to the rib and
  // joins the pile instead of riding for ever.
  var RIDE = 0.55;

  // The room floor in front of the machine. There is no payout basin: a coin
  // that leaves the deck falls down the front of the cabinet and stops here, on
  // the same plane the room floor is drawn on in render.js buildRoom()
  // (floor.position.y = -0.42). The floor is the destination, not a tray.
  var FLOOR_Y = -0.42;
  // A landed coin lies on the floor this long so the payout registers, then it
  // is gone. The floor is not a shelf, and lingering clutter reads as a bug.
  var TRAY_DWELL = 0.9;
  var TRAY_FADE = 0.5;
  var MAX_TRAY = 18;
  var MAX_COINS = 480, MAX_LAYER = 12;

  // Gravity for the payout drop.
  var GRAV = 3.6;

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
    return { dropped: 0, paid: 0, bigPaid: 0, lost: 0, ridden: 0, maxLayer: 0 };
  }

  // ── state ──────────────────────────────────────────────────────────────
  var Sim = {
    coins: [],        // on the deck
    fall: [],         // in true-3D freefall: the payout drop
    nextId: 1,
    t: 0,
    front: DECK.plate.back,   // z of the plate's leading rib
    vel: 0,                   // rib velocity, m/s
    dFront: 0,                // rib displacement this step, m
    rng: makeRng(1),
    stats: blankStats(),
    onPayout: null,   // fn(coin)
    onBigPayout: null,
    onLost: null,
    busy: false,      // a collect card is open; hold the world still

    grid: new Grid(0.11),
    _q: [],

    // Test seam: let tools re-shape the deck before reset() so geometry sweeps
    // run against the same code path the game uses.
    setDeck: function (tier, patch) {
      if (!patch) return;
      if (patch.lip != null) { DECK.table.lip = patch.lip; DECK.table.z1 = patch.lip; }
      if (patch.fwd != null) DECK.plate.fwd = patch.fwd;
      if (patch.back != null) DECK.plate.back = patch.back;
      if (patch.period != null) DECK.plate.period = patch.period;
      if (patch.payW != null) DECK.payW = patch.payW;
      if (patch.dropZ != null) DECK.dropZ = patch.dropZ;
      if (patch.ride != null) RIDE = patch.ride;
      if (patch.gutterZ != null) DECK.gutterZ = patch.gutterZ;
    },

    reset: function (seed) {
      this.coins.length = 0; this.fall.length = 0;
      this.nextId = 1; this.t = 0;
      this.rng = makeRng(seed == null ? 1 : seed);
      this._parkPlate();
      this.stats = blankStats();
      this.busy = false;
      if (this.payW == null) this.payW = DECK.payW;
    },

    _parkPlate: function () {
      var P = DECK.plate;
      var ph = (this.t % P.period) / P.period;
      var s = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
      this.front = P.back + (P.fwd - P.back) * s;
      this.vel = 0; this.dFront = 0;
    },

    // Is this coin standing on the raised plate rather than on the felt?
    // The plate spans from the back wall out to its rib, so the rib's z is the
    // only boundary. A quarter-radius of slack keeps a coin that is half over
    // the edge on the plate rather than snapping between levels.
    onPlate: function (c) {
      return c.z < this.front - c.r * 0.25;
    },

    // Base y a coin rests at, before layer height. Coins on the plate sit one
    // plate-thickness higher than coins in front of it.
    _baseY: function (c) {
      return this.onPlate(c) ? DECK.y + PLATE_DROP : DECK.y;
    },

    // Place a coin on the deck. kind: 'coin' | 'prop'
    spawn: function (x, z, kind, propId) {
      if (this.coins.length >= MAX_COINS) this._retireOldest();
      var def = kind === 'prop' ? G.CONTENT.PROPS[propId] : null;
      var r = def ? (def.radius || 0.11) : COIN_R;
      var m = def ? (def.weight || 2) : COIN_M;
      var c = {
        id: this.nextId++, x: x, z: z, l: 0, cy: 0.6,
        vx: 0, vz: 0, r: r, m: m, im: 1 / m,
        kind: kind, prop: propId || null, ax: 0, az: 0,
        fallT: 0.26,
        state: 'table', tier: 'main', _q: 0
      };
      this.coins.push(c);
      return c;
    },

    // The player's coin always lands on the plate: dropZ is behind the most
    // retracted rib position, so there is no phase of the stroke that puts the
    // drop point ahead of the plate.
    drop: function (x) {
      var t = DECK.table;
      var z = Math.min(DROP_Z, this.front - COIN_R * 1.2);
      z = Math.max(z, t.z0 + COIN_R);
      // A real chute is not a precision instrument: the coin tumbles out and
      // lands a little off. Kept under one coin radius so the player's aim still
      // means what it says -- enough to stop a perfectly centred tap from being a
      // guaranteed win on an empty-ish deck.
      var jx = (this.rng() - 0.5) * COIN_R * 1.2;
      var c = this.spawn(clamp(x + jx, t.x0 + COIN_R, t.x1 - COIN_R), z, 'coin', null);
      c.fallT = 0.30;
      c.cy = DECK.y + PLATE_DROP + 0.26;
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

    // Scatter a believable starting pile. A machine that has been on a shop
    // floor since 1972 is never sold empty, and one that starts empty reads as
    // broken rather than as a fresh challenge.
    seedPile: function (n) {
      var rnd = this.rng, t = DECK.table;
      for (var i = 0; i < n; i++) {
        var x = t.x0 + 0.05 + rnd() * (t.x1 - t.x0 - 0.10);
        var z = t.z0 + 0.06 + rnd() * (t.lip - t.z0 - 0.16);
        var c = this.spawn(x, z, 'coin', null);
        c.cy = this._baseY(c);
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

      this._sweep(dt);
      this._carry();
      this._recomputeLayers();
      this._move(dt);
      this._collide();
      this._rib();
      this._walls();
      this._payout();
      this._animateOnly(dt);
    },

    _sweep: function (dt) {
      var P = DECK.plate;
      var ph = (this.t % P.period) / P.period;
      var s = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
      var prev = this.front;
      this.front = P.back + (P.fwd - P.back) * s;
      // The stroke has a known top speed: d/dph of the cosine ease is PI, so
      // |v| <= |fwd - back| * PI / period. Anything above that can only come
      // from a discontinuity -- reset() dropping `front` back to its rest
      // position while the phase clock keeps running -- and a phantom stroke of
      // tens of m/s is enough to fire the whole seeded pile off the table and
      // send payout coins to z = 17. Clamp it at the physical bound.
      var vmax = Math.abs(P.fwd - P.back) * Math.PI / P.period * 1.5;
      var v = (this.front - prev) / dt;
      this.vel = v > vmax ? vmax : v < -vmax ? -vmax : v;
      this.dFront = this.front - prev;
    },

    // Carry the coins standing on the plate. Only the forward half of the
    // stroke moves them, and only by RIDE of it. On the return the slab slides
    // out from under them and they stay put -- which is what a plate with coins
    // resting on it actually does, and what makes the net drift forward.
    _carry: function () {
      var d = this.dFront;
      if (d <= 0) return;
      var moved = 0;
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        if (c.fallT > 0) continue;
        if (c.z > this.front - c.r * 0.25) continue;   // ahead of the rib: shoved, not carried
        c.z += d * RIDE;
        moved++;
      }
      if (moved) this.stats.ridden += moved;
    },

    _animateOnly: function (dt) {
      // visual settle: cy eases toward the surface + layer height
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        var target = this._baseY(c) + c.l * 0.0132;
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
          // still dropping from the chute: it does not collide yet
          c.x += c.vx * dt * 0.2;
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
              // sharing forward motion. Without this the pile above the rib
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

    _rib: function () {
      var face = this.front, vel = this.vel;
      for (var i = 0; i < this.coins.length; i++) {
        var c = this.coins[i];
        if (c.fallT > 0) continue;
        // Only what is in front of the rib is shoved. A coin behind it is
        // standing on the plate and is carried by _carry() instead.
        if (c.z < face) continue;
        var over = (face + c.r) - c.z;
        if (over > 0) {
          c.z += over;
          if (vel > 0 && c.vz < vel) c.vz = vel > 1.0 ? 1.0 : vel;
        }
      }
    },

    _walls: function () {
      var t = DECK.table;
      for (var i = this.coins.length - 1; i >= 0; i--) {
        var c = this.coins[i];
        if (c.z - c.r < t.z0) { c.z = t.z0 + c.r; c.vz = Math.abs(c.vz) * 0.3; }

        // The front edge is OPEN. There is no kerb to hold coins back: what
        // reaches the lip either goes through the slot and pays, or falls off
        // beside it into the machine. A kerb seems safer but it is a funnel --
        // it holds the heap and pile pressure squeezes every last coin into the
        // slot from the side, which measured a 100% return and made the wallet
        // a decoration.
        //
        // Side rails stop at the gutter line. In front of it the corners are
        // open too, so a heap pushed wide spills out there.
        if (c.z <= DECK.gutterZ) {
          if (c.x - c.r < t.x0) { c.x = t.x0 + c.r; c.vx = Math.abs(c.vx) * 0.35; }
          if (c.x + c.r > t.x1) { c.x = t.x1 - c.r; c.vx = -Math.abs(c.vx) * 0.35; }
        } else if (c.x - c.r * 0.5 < t.x0 || c.x + c.r * 0.5 > t.x1) {
          // Everything spills here, prizes included. A prop used to be clamped
          // back onto the felt, which meant a prize could never be lost -- and
          // also meant a prize shoved into the corner sat there for ever with
          // the player unable to reach it. Now it falls like everything else and
          // main.js re-queues it, so a lost prize always comes back.
          this._scrap(c);
        }
      }
    },

    // A coin that leaves the deck without paying. Same downstream treatment as
    // a coin outside the payout slot: it falls to the floor and is gone.
    _scrap: function (c) {
      var i = this.coins.indexOf(c);
      if (i < 0) return;
      this.coins.splice(i, 1);
      c.fx = c.x; c.fz = c.z; c.fy = this._baseY(c) + c.l * 0.0132;
      // A coin going over the side used to drop almost straight down and stop
      // at the machine's own footprint, where the cabinet hid it. Push it OUT
      // instead: the side rail is the only place coins leave the table, so the
      // arc is the player's whole read on "that one was mine and it got away".
      // Where it lands matters more than how hard it was hit. A coin that
      // leaves the side rail at z~0.20 falls into the gap BESIDE the tray,
      // which the fitted camera projects to ndc.x -1.2: off screen, behind the
      // cabinet. Measured across all four viewports, the lit floor band the
      // player can actually see is |x| 0.40-0.65, z 0.34-0.58. A 0.44 m drop
      // at GRAV takes ~0.49 s, so the arc is aimed at that band: forward about
      // 0.25 m, sideways only enough to drift inside 0.55.
      var away = c.x < 0 ? -1 : 1;
      var dx = (away * 0.55 - c.x);
      // Scatter the landing, or a rail that sheds four coins sheds one clump:
      // in the browser probe six spilt coins landed inside a 3 mm column and
      // read as a single object.
      c.fvx = clamp(dx / 0.49, -0.34, 0.34) + c.vx * 0.25 + (this.rng() - 0.5) * 0.26;
      c.fvz = 0.50 + Math.max(c.vz, 0) * 0.16 + (this.rng() - 0.5) * 0.20;
      c.fvy = 0.10;
      c.fax = (this.rng() - 0.5) * 9; c.faz = (this.rng() - 0.5) * 9;
      c.age = 0; c.state = 'lost';
      // `spill` is what the renderer tones the landing pool with: a coin that
      // got away must not light up the floor the same gold as a coin that paid.
      c.spill = true;
      this.fall.push(c);
      this.stats.lost++;
      if (this.onLost) this.onLost(c);
    },

    // Cross the lip. _walls() has already stopped everything outside the slot,
    // so almost every coin that gets here is inside it -- except a prop, whose
    // radius can straddle a brass cheek. A prize is never confiscated.
    _payout: function () {
      for (var i = this.coins.length - 1; i >= 0; i--) {
        var c = this.coins[i];
        if (c.fallT > 0) continue;
        if (!(c.z - c.r * 0.15 > DECK.table.lip)) continue;

        this.coins.splice(i, 1);
        c.fx = c.x;
        c.fz = c.z;
        c.fy = this._baseY(c) + c.l * 0.0132;
        c.fvy = 0.10;
        c.fax = (this.rng() - 0.5) * 9;
        c.faz = (this.rng() - 0.5) * 9;
        c.age = 0;
        c.fvz = clamp(Math.max(c.vz, 0.22) + 0.12, 0.10, 0.90);
        c.fvx = clamp(c.vx, -0.60, 0.60);

        var paid = c.kind === 'prop' || Math.abs(c.x) <= this.payW;
        c.state = paid ? 'falling' : 'lost';
        this.fall.push(c);

        if (!paid) {
          c.spill = true;
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

    // freefall integration, called with real dt from the render loop.
    stepFall: function (dt) {
      // Trim the paid coins on their way down BEFORE the pass: shifting inside
      // a reverse loop skips the coin that slid into the vacated slot and
      // integrates it twice. Nothing lands in a tray, but a burst of payouts
      // still must not spawn an unbounded number of shadow casters.
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

        // Once a coin is over the front edge there is nothing to catch it: paid
        // and lost coins both ride the same arc all the way down to the room
        // floor, sit there for the dwell so the player sees where it went, then
        // are gone.
        if (c.fy <= FLOOR_Y) {
          c.fy = FLOOR_Y;
          if (c.fvy < 0) c.fvy = 0;
          c.fvx *= 0.82; c.fvz *= 0.82;
          c.fax *= 0.86;
        }
        // A spilled coin stays on the floor visibly longer than a paid one.
        // The paid coin is a reward the HUD already announced; the spilled one
        // is information, and information needs time to be read.
        var dwell = c.spill ? TRAY_DWELL * 1.9 : TRAY_DWELL;
        if (c.age > dwell) this.fall.splice(i, 1);
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

    countOnPlate: function () {
      var n = 0;
      for (var i = 0; i < this.coins.length; i++) if (this.onPlate(this.coins[i])) n++;
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
    s.front = DECK.plate.back; s.vel = 0; s.dFront = 0;
    s.rng = makeRng(1); s.busy = false;
    s.stats = blankStats();
    s._parkPlate();
    s.onPayout = null; s.onBigPayout = null; s.onLost = null;
    return s;
  };

  Sim.COIN_R = COIN_R; Sim.STEP = STEP;
  Sim.MAX_COINS = MAX_COINS; Sim.MAX_LAYER = MAX_LAYER;
  Sim.DECK = DECK; Sim.DECKS = DECKS; Sim.TOP = TOP; Sim.BOTTOM = BOT;
  Sim.TABLE = TABLE; Sim.PLATE = PLATE;
  Sim.DROP_Z = DROP_Z; Sim.FLOOR_Y = FLOOR_Y; Sim.TRAY_Y = FLOOR_Y;
  Sim.TRAY_DWELL = TRAY_DWELL; Sim.TRAY_FADE = TRAY_FADE;
  Sim.PAY_W = PAY_W; Sim.GRAV = GRAV;
  Sim.PLATE_DROP = PLATE_DROP; Sim.RIDE = RIDE;
  Sim.makeRng = makeRng;
  Sim.clamp = clamp;
  G.Sim = Sim;
})(window);
