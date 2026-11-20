// tools/sweep1.mjs — parameter sweep for the single-deck sim.
//   node tools/sweep1.mjs
// Prints a compact table so the economy can be tuned by measurement instead of
// by feel. Every row is one 300 s session feeding a coin every 1.2 s.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function load() {
  const win = {};
  const ctx = vm.createContext({ window: win, Math, console, Array, Object, Number, JSON, String });
  vm.runInContext(readFileSync(join(ROOT, 'content.js'), 'utf8'), ctx, { filename: 'content.js' });
  vm.runInContext(readFileSync(join(ROOT, 'sim.js'), 'utf8'), ctx, { filename: 'sim.js' });
  return win.Sim;
}
const Sim = load();

function run(cfg) {
  const s = Sim.create();
  s.setDeck('main', cfg);
  s.reset(7);
  s.seedPile(cfg.seed ?? 90);
  let next = 0;
  const steps = Math.round((cfg.secs ?? 300) / Sim.STEP);
  const every = cfg.every ?? 1.2;
  const aim = cfg.aim ?? 0;
  let onPlateSum = 0, samples = 0;
  for (let i = 0; i < steps; i++) {
    const t = i * Sim.STEP;
    if (t >= next) { s.drop(aim); next += every; }
    s.step(Sim.STEP);
    if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
    if (i % 15 === 0) { onPlateSum += s.countOnPlate(); samples++; }
  }
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    paid: s.stats.paid, lost: s.stats.lost,
    tbl: s.coins.length, plate: +(onPlateSum / Math.max(1, samples)).toFixed(1),
    mx: s.stats.maxLayer, ridden: s.stats.ridden
  };
}

const base = { secs: 300, seed: 90 };
const rows = [];

// 1. payout width: full-width lip vs narrow slot
for (const payW of [0.62, 0.31, 0.22]) {
  rows.push([`payW ${payW}`, run({ ...base, payW, aim: 0 })]);
}

// 2. plate geometry: how far the rib reaches back behind the drop point
for (const [back, fwd, dropZ] of [[-0.22, 0.10, -0.30], [-0.38, 0.06, -0.32], [-0.44, 0.02, -0.38]]) {
  rows.push([`plate ${back}/${fwd} drop ${dropZ}`, run({ ...base, back, fwd, dropZ, payW: 0.31, aim: 0 })]);
}

// 3. RIDE: how much of the stroke a coin on the plate is carried by
for (const ride of [0.3, 0.55, 0.8, 1.0]) {
  rows.push([`ride ${ride}`, run({ ...base, ride, payW: 0.31, aim: 0 })]);
}

// 4. side gutter: where the rails stop
for (const gutterZ of [-0.10, 0.10, 0.20]) {
  rows.push([`gutter ${gutterZ}`, run({ ...base, gutterZ, payW: 0.31, aim: 0 })]);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('config', 26), pad('ret', 6), pad('paid', 6), pad('lost', 6), pad('tbl', 5), pad('plate', 6), pad('mx', 4), 'ridden');
for (const [label, r] of rows) {
  console.log(pad(label, 26), pad(r.ret, 6), pad(r.paid, 6), pad(r.lost, 6), pad(r.tbl, 5), pad(r.plate, 6), pad(r.mx, 4), r.ridden);
}
