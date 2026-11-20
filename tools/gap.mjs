// tools/gap.mjs — the compression gap: plate forward limit vs lip.
//   node tools/gap.mjs
// The plate stops at `fwd`; the lip is fixed. Coins in the gap are only moved by
// pile pressure from behind, not by the plate itself. A bigger gap means a sparse
// pile stalls instead of paying, which lowers the return WITHOUT narrowing the
// payout slot -- so the slot can stay visually generous.
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

function run(patch, aim, every) {
  const s = Sim.create();
  s.setDeck('main', patch);
  s.reset(7);
  s.seedPile(90);
  segment(s, 240, aim, every);
  for (const k of ['dropped', 'paid', 'lost', 'ridden', 'maxLayer']) s.stats[k] = 0;
  const plate = segment(s, 240, aim, every);
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    lost: s.stats.lost,
    bed: s.coins.length,
    plate: +plate.toFixed(1),
    mx: s.stats.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('fwd/payW/aim', 16), pad('ret', 6), pad('lost', 5), pad('bed', 5), pad('plate', 6), 'mx');
for (const fwd of [0.10, 0.02, -0.06]) {
  for (const payW of [0.31, 0.22]) {
    for (const aim of [0, 0.30]) {
      const r = run({ fwd, payW }, aim, 0.6);
      console.log(pad(`${fwd}/${payW}/${aim}`, 16), pad(r.ret, 6), pad(r.lost, 5), pad(r.bed, 5), pad(r.plate, 6), r.mx);
    }
  }
}
