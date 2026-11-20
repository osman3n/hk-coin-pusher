/* Long-run check: the short sweep measures a 180 s window that starts with a
 * free seeded pile, so its return rate is inflated. What matters is the
 * equilibrium -- return rate once the table has reached its steady mass. */
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

function run(patch, secs = 900) {
  const { Sim } = load(patch);
  const s = Sim.create();
  s.reset(11); s.seedPile(64);
  let paid = 0, dropped = 0;
  s.onPayout = () => paid++;
  const windows = [];
  let winPaid = 0, winDropped = 0, nextDrop = 0, nextWin = 120;
  const steps = secs * 120;
  for (let i = 0; i < steps; i++) {
    if (s.t >= nextDrop) {
      s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45);
      dropped++; winDropped++; nextDrop += DROP_EVERY;
    }
    s.step(Sim.STEP);
    if (s.t >= nextWin) {
      windows.push(+(winPaid / Math.max(1, winDropped)).toFixed(2));
      winPaid = 0; winDropped = 0; nextWin += 120;
    }
    winPaid = paid - (winPaid, paid - winPaid); // no-op guard
  }
  return { windows, coins: s.coins.length };
}

// simpler: track window deltas explicitly
function run2(patch, secs = 900) {
  const { Sim } = load(patch);
  const s = Sim.create();
  s.reset(11); s.seedPile(64);
  let paid = 0, dropped = 0;
  s.onPayout = () => paid++;
  let lastPaid = 0, lastDropped = 0, nextDrop = 0, nextWin = 120;
  const windows = [];
  const steps = secs * 120;
  for (let i = 0; i < steps; i++) {
    if (s.t >= nextDrop) { s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45); dropped++; nextDrop += DROP_EVERY; }
    s.step(Sim.STEP);
    if (s.t >= nextWin) {
      const dp = dropped - lastDropped, pp = paid - lastPaid;
      windows.push(+(pp / Math.max(1, dp)).toFixed(2));
      lastPaid = paid; lastDropped = dropped; nextWin += 120;
    }
  }
  return { windows, coins: s.coins.length };
}

for (const p of [
  { plate: '{ back: -0.40, fwd: 0.02, period: 2.6 }', mu: [4.5, 9.0] },
  { plate: '{ back: -0.40, fwd: -0.02, period: 2.6 }', mu: [3.4, 7.0] },
  { plate: '{ back: -0.40, fwd: -0.02, period: 2.6 }', mu: [4.5, 9.0] },
]) {
  const r = run2(p);
  console.log(JSON.stringify({ plate: p.plate, mu: p.mu, windows: r.windows, coins: r.coins }));
}
