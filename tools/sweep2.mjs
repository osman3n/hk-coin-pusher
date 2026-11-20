// tools/sweep2.mjs — economy sweep over the axes that actually decide it.
//   node tools/sweep2.mjs
// A pusher pays back 100% whenever the bed is loose: with no pile pressure
// nothing is squeezed out of the open front corners, so every coin that is fed
// eventually reaches the slot. The economy lives in (a) how far one stroke
// carries a coin -- too far and the plate is a conveyor, (b) how packed the bed
// is, and (c) how much of the heap the open corners can swallow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function load(muCoin) {
  const win = {};
  const ctx = vm.createContext({ window: win, Math, console, Array, Object, Number, JSON, String });
  let src = readFileSync(join(ROOT, 'sim.js'), 'utf8');
  if (muCoin != null) src = src.replace('MU_COIN = 2.1', `MU_COIN = ${muCoin}`);
  vm.runInContext(readFileSync(join(ROOT, 'content.js'), 'utf8'), ctx, { filename: 'content.js' });
  vm.runInContext(src, ctx, { filename: 'sim.js' });
  return win.Sim;
}

function run(Sim, cfg) {
  const s = Sim.create();
  s.setDeck('main', cfg);
  s.reset(7);
  s.seedPile(cfg.seed);
  const every = 1.2, aim = cfg.aim ?? 0;
  let next = 0, plateSum = 0, samples = 0;
  const steps = Math.round(cfg.secs / Sim.STEP);
  for (let i = 0; i < steps; i++) {
    const t = i * Sim.STEP;
    if (t >= next) { s.drop(aim); next += every; }
    s.step(Sim.STEP);
    if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
    if (i % 20 === 0) { plateSum += s.countOnPlate(); samples++; }
  }
  return {
    ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
    paid: s.stats.paid, lost: s.stats.lost,
    bed: s.coins.length, plate: +(plateSum / Math.max(1, samples)).toFixed(1),
    mx: s.stats.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('config', 34), pad('ret', 6), pad('paid', 6), pad('lost', 6), pad('bed', 5), pad('plate', 6), 'mx');

const rows = [];
for (const mu of [2.1, 5, 9, 14]) {
  for (const ride of [0.10, 0.22, 0.36]) {
    for (const seed of [200]) {
      const Sim = load(mu);
      const r = run(Sim, { secs: 600, seed, ride, payW: 0.31, gutterZ: 0.10 });
      rows.push([`mu ${mu} ride ${ride} seed ${seed}`, r]);
    }
  }
}
for (const [label, r] of rows) {
  console.log(pad(label, 34), pad(r.ret, 6), pad(r.paid, 6), pad(r.lost, 6), pad(r.bed, 5), pad(r.plate, 6), r.mx);
}
