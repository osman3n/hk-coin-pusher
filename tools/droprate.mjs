// tools/droprate.mjs — long press means many coins per second. Does that break it?
//   node tools/droprate.mjs
// The user asked for long-press dropping, so the drop interval becomes a player
// variable (1.2 s single tap .. ~0.30 s held). Higher input rate packs the bed,
// and a packed bed transmits force better, so the return rate is not constant in
// drop rate. This is the measurement that decides whether long press is a skill
// or an exploit.
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

function run(payW, aim, every) {
  const s = Sim.create();
  s.reset(7);
  s.payW = payW;
  s.seedPile(90);
  segment(s, 200, aim, every);
  for (const k of ['dropped', 'paid', 'lost', 'ridden', 'maxLayer']) s.stats[k] = 0;
  const plate = segment(s, 200, aim, every);
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    lost: s.stats.lost,
    bed: s.coins.length,
    plate: +plate.toFixed(1),
    mx: s.stats.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('payW/every/aim', 20), pad('ret', 6), pad('lost', 5), pad('bed', 5), pad('plate', 6), 'mx');
for (const payW of [0.13, 0.18]) {
  for (const every of [1.2, 0.6, 0.3]) {
    for (const aim of [0, 0.35]) {
      const r = run(payW, aim, every);
      console.log(pad(`${payW}/${every}/${aim}`, 20), pad(r.ret, 6), pad(r.lost, 5), pad(r.bed, 5), pad(r.plate, 6), r.mx);
    }
  }
}
