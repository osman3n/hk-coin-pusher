/* Sweep plate geometry + friction, report the three numbers that decide the feel:
 *   coinReturn  — paid coins per coin dropped (want ~0.55-0.85: a sink, but alive)
 *   propTime    — seconds to surface one small prop (want 20-60)
 *   bigTime     — seconds to surface one big prop (want 90-240, must be possible)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const base = readFileSync(`${root}/sim.js`, 'utf8');

function load(patch) {
  const win = { Math, console };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(readFileSync(`${root}/content.js`, 'utf8'), win, { filename: 'content.js' });
  let src = base;
  if (patch.__PLATE) {
    src = src.replace(/var PLATE = \{[^}]*\}/, `var PLATE = ${patch.__PLATE}`);
  }
  if (patch.MU_COIN != null) {
    src = src.replace(/var MU_COIN = [\d.]+, MU_PROP = [\d.]+;/,
      `var MU_COIN = ${patch.MU_COIN}, MU_PROP = ${patch.MU_PROP};`);
  }
  vm.runInContext(src, win, { filename: 'sim.js' });
  return { Sim: win.Sim, C: win.CONTENT };
}

function sim(patch) {
  const { Sim, C } = load(patch);
  const s = Sim.create();
  s.reset(11); s.seedPile(64);
  let coinPaid = 0, dropped = 0;
  s.onPayout = () => coinPaid++;

  // props: put one small and one big on the table, time how long to surface each
  const smallId = Object.keys(C.PROPS).find(k => !C.PROPS[k].big);
  const bigId = Object.keys(C.PROPS).find(k => C.PROPS[k].big);
  const watched = [];
  const pSmall = s.spawn(-0.20, -0.30, 'prop', smallId); pSmall.fallT = 0;
  const pBig = s.spawn(0.20, -0.32, 'prop', bigId); pBig.fallT = 0;
  let smallAt = -1, bigAt = -1;
  s.onBigPayout = c => {
    if (c.id === pBig.id && bigAt < 0) bigAt = s.t;
    if (c.id === pSmall.id && smallAt < 0) smallAt = s.t;
  };
  const steps = 120 * 300; // 5 simulated minutes
  for (let i = 0; i < steps; i++) {
    if (i % 150 === 0) { s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45); dropped++; }
    s.step(Sim.STEP);
    if (smallAt >= 0 && bigAt >= 0) break;
  }
  return {
    patch: JSON.stringify(patch),
    coinReturn: +(coinPaid / Math.max(1, dropped)).toFixed(2),
    smallAt: smallAt < 0 ? null : +smallAt.toFixed(1),
    bigAt: bigAt < 0 ? null : +bigAt.toFixed(1),
    coins: s.coins.length,
    maxLayer: Math.max(...s.layerHistogram().map((v, i) => v ? i : 0)),
    hist: s.layerHistogram().slice(0, 8)
  };
}

const configs = [
  { __PLATE: '{ back: -0.40, fwd: 0.02, period: 2.6 }', MU_COIN: 2.1, MU_PROP: 4.5 },
  { __PLATE: '{ back: -0.40, fwd: -0.04, period: 2.6 }', MU_COIN: 2.1, MU_PROP: 4.5 },
  { __PLATE: '{ back: -0.40, fwd: -0.10, period: 2.6 }', MU_COIN: 2.1, MU_PROP: 4.5 },
  { __PLATE: '{ back: -0.40, fwd: -0.10, period: 2.6 }', MU_COIN: 3.2, MU_PROP: 6.0 },
  { __PLATE: '{ back: -0.42, fwd: -0.08, period: 2.2 }', MU_COIN: 3.0, MU_PROP: 5.5 },
  { __PLATE: '{ back: -0.42, fwd: -0.08, period: 2.2 }', MU_COIN: 2.4, MU_PROP: 4.0 },
  { __PLATE: '{ back: -0.42, fwd: -0.12, period: 2.2 }', MU_COIN: 2.4, MU_PROP: 4.0 },
  { __PLATE: '{ back: -0.42, fwd: -0.12, period: 1.9 }', MU_COIN: 1.9, MU_PROP: 3.2 }
];

for (const c of configs) {
  try { console.log(JSON.stringify(sim(c))); }
  catch (e) { console.log('ERR', JSON.stringify(c), e.message); }
}
