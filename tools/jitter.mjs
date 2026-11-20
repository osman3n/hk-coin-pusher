// tools/jitter.mjs — the pile is too centred because coins land exactly at x=aim.
//   node tools/jitter.mjs
// Every measurement so far dropped coins at precisely x=0, so the bed that builds
// up is a narrow stripe down the middle and 96% of lip crossings land inside the
// slot. Real coins come off a chute and bounce a little. This measures how much
// mechanical scatter is needed to make the slot width mean something -- while
// keeping aim a real skill (a wide aim should still lose).
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

function segment(s, secs, aim, scatter, every) {
  let next = 0, plateSum = 0, samples = 0;
  const n = Math.round(secs * 120);
  for (let i = 0; i < n; i++) {
    if ((i * Sim.STEP) >= next) {
      s.drop(aim + (s.rng() - 0.5) * scatter);
      next += every;
    }
    s.step(Sim.STEP);
    if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
    if (i % 20 === 0) { plateSum += s.countOnPlate(); samples++; }
  }
  return plateSum / Math.max(1, samples);
}

function run(payW, aim, scatter) {
  const s = Sim.create();
  s.reset(7);
  s.payW = payW;
  s.seedPile(110);
  segment(s, 150, aim, scatter, 1.2);
  for (const k of ['dropped', 'paid', 'lost', 'ridden', 'maxLayer']) s.stats[k] = 0;
  const plate = segment(s, 150, aim, scatter, 1.2);
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    lost: s.stats.lost,
    bed: s.coins.length,
    plate: +plate.toFixed(1),
    mx: s.stats.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('payW/scatter/aim', 20), pad('ret', 6), pad('lost', 5), pad('bed', 5), pad('plate', 6), 'mx');
for (const scatter of [0, 0.08, 0.16]) {
  for (const payW of [0.31, 0.22]) {
    for (const aim of [0, 0.30]) {
      const r = run(payW, aim, scatter);
      console.log(pad(`${payW}/${scatter}/${aim}`, 20), pad(r.ret, 6), pad(r.lost, 5), pad(r.bed, 5), pad(r.plate, 6), r.mx);
    }
  }
}
