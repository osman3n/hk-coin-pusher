// tools/sweep3.mjs — measure the MARGINAL economy, not the seeded pile's payout.
//   node tools/sweep3.mjs
// Counting every paid coin since reset includes the seed pile draining out, which
// reads as a generous machine when it is really just the starting bed leaving.
// So: warm up until the bed settles, zero the stats, then measure the next window.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT = readFileSync(join(ROOT, 'content.js'), 'utf8');
const SIMSRC = readFileSync(join(ROOT, 'sim.js'), 'utf8');

const cache = new Map();
function load(patches) {
  const key = JSON.stringify(patches);
  if (cache.has(key)) return cache.get(key);
  const win = {};
  const ctx = vm.createContext({ window: win, Math, console, Array, Object, Number, JSON, String });
  let src = SIMSRC;
  for (const [find, repl] of patches) src = src.replace(find, repl);
  vm.runInContext(CONTENT, ctx, { filename: 'content.js' });
  vm.runInContext(src, ctx, { filename: 'sim.js' });
  cache.set(key, win.Sim);
  return win.Sim;
}

function segment(s, secs, aim, every) {
  let next = s.t + 0.0001, plateSum = 0, samples = 0;
  const steps = Math.round(secs / s.constructor.STEP || 0);
  const n = Math.round(secs * 120);
  for (let i = 0; i < n; i++) {
    const t = s.t;
    if (t >= next) { s.drop(aim); next += every; }
    s.step(1 / 120);
    if (i % 6 === 0) s.stepFall(1 / 20);
    if (i % 20 === 0) { plateSum += s.countOnPlate(); samples++; }
  }
  return { plate: plateSum / Math.max(1, samples) };
}

function run(Sim, cfg) {
  const s = Sim.create();
  s.setDeck('main', cfg);
  s.reset(7);
  s.seedPile(cfg.seed);
  const aim = cfg.aim ?? 0;
  segment(s, cfg.warm || 280, aim, 1.2);
  const bed = s.coins.length;
  const st = s.stats;
  st.dropped = 0; st.paid = 0; st.lost = 0; st.ridden = 0; st.maxLayer = 0;
  const { plate } = segment(s, cfg.meas || 280, aim, 1.2);
  return {
    ret: +(st.paid / Math.max(1, st.dropped)).toFixed(3),
    lost: st.lost,
    bed,
    plate: +plate.toFixed(1),
    mx: st.maxLayer
  };
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('config', 26), pad('ret', 6), pad('lost', 6), pad('bed', 5), pad('plate', 6), 'mx');

const MUC = 'MU_COIN = 2.1', PAY = 'payW: 0.31', RIDEV = 'RIDE = 0.55';
for (const mu of [2.1, 6, 12]) {
  for (const payW of [0.31, 0.20, 0.13]) {
    const Sim = load([
      [MUC, `MU_COIN = ${mu}`],
      [PAY, `payW: ${payW}`]
    ]);
    for (const aim of [0, 0.40]) {
      const r = run(Sim, { seed: 200, payW, aim, warm: 280, meas: 280 });
      console.log(pad(`mu${mu} payW${payW} aim${aim}`, 26), pad(r.ret, 6), pad(r.lost, 6), pad(r.bed, 5), pad(r.plate, 6), r.mx);
    }
  }
}
