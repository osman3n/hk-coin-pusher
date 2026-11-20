// tools/xspread.mjs — WHERE do coins cross the lip, and how wide is the bed?
//   node tools/xspread.mjs [--secs=400] [--seed=90] [--aim=0]
// The return rate is decided by one number nobody has measured yet: the x-spread
// of coins at the lip. If that is narrower than payW, every coin pays and the
// wallet becomes a decoration no matter how the other constants are tuned.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? +m.split('=')[1] : d;
};

const win = {};
const ctx = vm.createContext({ window: win, Math, console, Array, Object, Number, JSON, String });
vm.runInContext(readFileSync(join(ROOT, 'content.js'), 'utf8'), ctx, { filename: 'content.js' });
vm.runInContext(readFileSync(join(ROOT, 'sim.js'), 'utf8'), ctx, { filename: 'sim.js' });
const Sim = win.Sim;

const secs = arg('secs', 400);
const seedN = arg('seed', 90);
const aim = arg('aim', 0);

const s = Sim.create();
s.reset(7);
s.seedPile(seedN);

// Record the x of every coin the moment it crosses the lip, before the slot
// test decides pay or drop.
const lipX = [];
const LIP = Sim.DECK.table.lip;
const origPayout = s._payout.bind(s);
s._payout = function () {
  for (const c of this.coins) {
    if (c.fallT > 0) continue;
    if (!(c.z - c.r * 0.15 > LIP)) continue;
    lipX.push(+c.x.toFixed(4));
  }
  return origPayout();
};

const every = 1.2;
let next = 0;
const steps = Math.round(secs / Sim.STEP);
for (let i = 0; i < steps; i++) {
  const t = i * Sim.STEP;
  if (t >= next) { s.drop(aim); next += every; }
  s.step(Sim.STEP);
  if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
}

const hist = {};
for (const x of lipX) {
  const b = Math.floor(Math.abs(x) / 0.05) * 0.05;
  const k = (x < 0 ? '-' : '+') + b.toFixed(2);
  hist[k] = (hist[k] || 0) + 1;
}
const abs = lipX.map(Math.abs).sort((a, b) => a - b);
const q = (p) => (abs.length ? +abs[Math.min(abs.length - 1, Math.floor(p * abs.length))].toFixed(3) : null);
const bed = s.coins;
console.log(JSON.stringify({
  secs, seed: seedN, aim, payW: Sim.PAY_W,
  lipCrossings: lipX.length,
  paid: s.stats.paid, lost: s.stats.lost,
  ret: +(s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3),
  bed: bed.length,
  lipAbsX: { p50: q(0.5), p75: q(0.75), p90: q(0.9), p100: q(0.999) },
  shareInsidePayW: +(lipX.filter((x) => Math.abs(x) <= Sim.PAY_W).length / Math.max(1, lipX.length)).toFixed(3),
  hist,
  bedX: { min: +Math.min(...bed.map((c) => c.x)).toFixed(2), max: +Math.max(...bed.map((c) => c.x)).toFixed(2) },
  bedZ: { min: +Math.min(...bed.map((c) => c.z)).toFixed(2), max: +Math.max(...bed.map((c) => c.z)).toFixed(2) }
}, null, 1));
