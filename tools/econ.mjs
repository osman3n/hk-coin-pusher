// tools/econ.mjs — final economy check on the SHIPPED defaults.
//   node tools/econ.mjs
// No patches: this reads sim.js as it is, so a green result here means the file
// the game loads is balanced. Warm up, zero the stats, then measure the window.
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

function run(aim, every, seedN) {
  const s = Sim.create();
  s.reset(7);
  s.seedPile(seedN);
  segment(s, 240, aim, every);
  for (const k of ['dropped', 'paid', 'lost', 'ridden', 'maxLayer']) s.stats[k] = 0;
  const plate = segment(s, 240, aim, every);
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    paid: s.stats.paid,
    lost: s.stats.lost,
    bed: s.coins.length,
    plate: +plate.toFixed(1),
    mx: s.stats.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log('defaults:', JSON.stringify({
  fwd: Sim.DECK.plate.fwd, back: Sim.DECK.plate.back, period: Sim.DECK.plate.period,
  lip: Sim.DECK.table.lip, payW: Sim.PAY_W, dropZ: Sim.DROP_Z
}));
console.log(pad('aim/every', 12), pad('ret', 6), pad('paid', 6), pad('lost', 6), pad('bed', 5), pad('plate', 6), 'mx');

// tap (1.2s) and long-press (0.35s) at three aims: centred, off-slot, and a
// wild shot that must punish.
for (const every of [1.2, 0.35]) {
  for (const aim of [0, 0.30, 0.70]) {
    const r = run(aim, every, 90);
    console.log(pad(`${aim}/${every}`, 12), pad(r.ret, 6), pad(r.paid, 6), pad(r.lost, 6), pad(r.bed, 5), pad(r.plate, 6), r.mx);
  }
}
