/* Focused sweep. A real player drops roughly one coin per 1.2 s, so the sim
 * must too -- dropping every physics step (120/s) saturates MAX_COINS and
 * makes every number meaningless.
 *
 *   coinReturn — paid per dropped. Want 0.60-0.85: a sink, but alive.
 *   smallAt    — seconds until a small prop falls. Want 15-60.
 *   bigAt      — seconds until a big prop falls. Want 60-200, must happen.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = readFileSync(`${root}/sim.js`, 'utf8');
const content = readFileSync(`${root}/content.js`, 'utf8');

const DROP_EVERY = 1.2;

function load(patch) {
  const win = { Math, console };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(content, win, { filename: 'content.js' });
  let src = base;
  if (patch.plate) src = src.replace(/var PLATE = \{[^}]*\}/, `var PLATE = ${patch.plate}`);
  if (patch.mu) {
    src = src.replace(/var MU_COIN = [\d.]+, MU_PROP = [\d.]+;/,
      `var MU_COIN = ${patch.mu[0]}, MU_PROP = ${patch.mu[1]};`);
  }
  vm.runInContext(src, win, { filename: 'sim.js' });
  return { Sim: win.Sim, C: win.CONTENT };
}

function run(patch, secs = 180) {
  const { Sim, C } = load(patch);
  const s = Sim.create();
  s.reset(11); s.seedPile(64);
  let paid = 0, dropped = 0;
  s.onPayout = () => paid++;

  const smallId = Object.keys(C.PROPS).find(k => !C.PROPS[k].big);
  const bigId = Object.keys(C.PROPS).find(k => C.PROPS[k].big);
  // surface both at the back of the table, the way the game does
  const a = s.spawn(-0.20, -0.30, 'prop', smallId); a.fallT = 0;
  const b = s.spawn(0.20, -0.32, 'prop', bigId); b.fallT = 0;
  let smallAt = null, bigAt = null;
  const gone = new Set();
  s.onBigPayout = (c) => { gone.add(c.id); };

  const steps = secs * 120;
  let nextDrop = 0;
  for (let i = 0; i < steps; i++) {
    if (s.t >= nextDrop) {
      s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45);
      dropped++; nextDrop += DROP_EVERY;
    }
    s.step(Sim.STEP);
    if (smallAt === null && a.state !== 'table') smallAt = +s.t.toFixed(1);
    if (bigAt === null && b.state !== 'table') bigAt = +s.t.toFixed(1);
  }
  const layers = s.coins.map(c => c.l || 0);
  return {
    coinReturn: dropped ? +(paid / dropped).toFixed(2) : 0,
    smallAt, bigAt,
    coins: s.coins.length,
    maxLayer: layers.length ? Math.max(...layers) : 0,
  };
}

const patches = [
  { plate: '{ back: -0.40, fwd: 0.02, period: 2.6 }', mu: [2.1, 4.5] },
  { plate: '{ back: -0.40, fwd: 0.02, period: 2.6 }', mu: [3.4, 7.0] },
  { plate: '{ back: -0.40, fwd: 0.02, period: 2.6 }', mu: [4.5, 9.0] },
  { plate: '{ back: -0.40, fwd: -0.02, period: 2.6 }', mu: [3.4, 7.0] },
  { plate: '{ back: -0.40, fwd: 0.02, period: 3.2 }', mu: [3.4, 7.0] },
  { plate: '{ back: -0.38, fwd: 0.02, period: 2.6 }', mu: [3.4, 7.0] },
];
for (const p of patches) {
  const r = run(p);
  console.log(JSON.stringify({ plate: p.plate, mu: p.mu, ...r }));
}
