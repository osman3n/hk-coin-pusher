// tools/density.mjs — does a THICKER bed break the conveyor?
//   node tools/density.mjs
// Reading so far: with ~58 coins the table is 28% covered, one layer deep, and
// every coin slides straight to the lip. A real machine is packed, so the pile's
// lateral pressure is what decides win or lose. Warm up, zero stats, measure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const win = {};
const ctx = vm.createContext({ window: win, Math, console, Array, Object, Number, JSON, String });
vm.runInContext(readFileSync(join(ROOT, 'content.js'), 'utf8'), ctx, { filename: 'content.js' });
vm.runInContext(readFileSync(join(ROOT, 'sim.js'), 'utf8'), ctx, { filename: 'sim.js' });
const Sim = win.Sim;

function segment(s, secs, aim, every) {
  let next = 0, plateSum = 0, samples = 0;
  const n = Math.round(secs * 120);
  for (let i = 0; i < n; i++) {
    if ((i * Sim.STEP) >= next) { s.drop(aim); next += every; }
    s.step(Sim.STEP);
    if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
    if (i % 20 === 0) { plateSum += s.countOnPlate(); samples++; }
  }
  return plateSum / Math.max(1, samples);
}

function run(seedN, payW, aim, every) {
  const s = Sim.create();
  s.reset(7);
  s.payW = payW;
  s.seedPile(seedN);
  segment(s, 240, aim, every);
  const bed0 = s.coins.length;
  for (const k of ['dropped', 'paid', 'lost', 'ridden', 'maxLayer']) s.stats[k] = 0;
  const plate = segment(s, 240, aim, every);
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    lost: s.stats.lost,
    bed0,
    bed1: s.coins.length,
    plate: +plate.toFixed(1),
    mx: s.stats.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('seed/payW/aim/ev', 20), pad('ret', 6), pad('lost', 5), pad('bed0', 5), pad('bed1', 5), pad('plate', 6), 'mx');
for (const seedN of [58, 150, 300, 420]) {
  const r = run(seedN, 0.31, 0, 1.2);
  console.log(pad(`${seedN}/0.31/0/1.2`, 20), pad(r.ret, 6), pad(r.lost, 5), pad(r.bed0, 5), pad(r.bed1, 5), pad(r.plate, 6), r.mx);
}
