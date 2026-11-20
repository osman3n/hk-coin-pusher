// tools/payw.mjs — the one knob that actually moves the economy.
//   node tools/payw.mjs
// `this.payW` is an instance property, so it can be swept on a live sim without
// rebuilding the source. Warm up first, then zero the stats: the seeded bed
// draining out is not the machine's economy, it is the starting pile leaving.
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

function segment(s, secs, aim) {
  const every = 1.2;
  let next = s._now || 0, plateSum = 0, samples = 0;
  const n = Math.round(secs * 120);
  for (let i = 0; i < n; i++) {
    if ((i * Sim.STEP) >= next) { s.drop(aim); next += every; }
    s.step(Sim.STEP);
    if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
    if (i % 20 === 0) { plateSum += s.countOnPlate(); samples++; }
  }
  return plateSum / Math.max(1, samples);
}

function run(payW, aim, seedN) {
  const s = Sim.create();
  s.reset(7);
  s.payW = payW;
  s.seedPile(seedN);
  segment(s, 200, aim);
  const bed = s.coins.length;
  for (const k of ['dropped', 'paid', 'lost', 'ridden', 'maxLayer']) s.stats[k] = 0;
  const plate = segment(s, 200, aim);
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    lost: s.stats.lost,
    bed,
    plate: +plate.toFixed(1),
    mx: s.stats.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('payW/aim', 12), pad('ret', 6), pad('lost', 6), pad('bed', 5), pad('plate', 6), 'mx');
for (const payW of [0.31, 0.20, 0.16, 0.13, 0.10]) {
  for (const aim of [0, 0.40]) {
    const r = run(payW, aim, 90);
    console.log(pad(`${payW}/${aim}`, 12), pad(r.ret, 6), pad(r.lost, 6), pad(r.bed, 5), pad(r.plate, 6), r.mx);
  }
}
