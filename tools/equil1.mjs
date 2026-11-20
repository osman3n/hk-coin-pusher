// tools/equil1.mjs — long-run marginal return rate.
//   node tools/equil1.mjs [--secs=1500] [--aim=0]
// The headline paid/dropped ratio is not the economy: a coin pusher starts with
// a full bed and pays that bed out on top of what it is fed, so early windows
// look generous no matter how the machine is built. What decides whether a
// player's wallet can actually move is the MARGINAL rate once the bed has
// settled. This measures that, window by window.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function argNum(name, dflt) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) {
    const v = Number(hit.split('=')[1]);
    if (!Number.isFinite(v)) { console.error(`bad --${name}`); process.exit(2); }
    return v;
  }
  return dflt;
}

const win = {};
const ctx = vm.createContext({ window: win, Math, console, Array, Object, Number, JSON, String });
vm.runInContext(readFileSync(join(ROOT, 'content.js'), 'utf8'), ctx, { filename: 'content.js' });
vm.runInContext(readFileSync(join(ROOT, 'sim.js'), 'utf8'), ctx, { filename: 'sim.js' });
const Sim = win.Sim;

const secs = argNum('secs', 1500);
const aim = argNum('aim', 0);
const seed = argNum('seed', 90);
const every = argNum('every', 1.2);
const WINDOW = argNum('window', 150);

const s = Sim.create();
s.reset(7);
s.seedPile(seed);

let next = 0, lastPaid = 0, lastDropped = 0;
const steps = Math.round(secs / Sim.STEP);
const rows = [];
for (let i = 0; i < steps; i++) {
  const t = i * Sim.STEP;
  if (t >= next) { s.drop(aim); next += every; }
  s.step(Sim.STEP);
  if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
  if ((i + 1) % Math.round(WINDOW / Sim.STEP) === 0) {
    const dp = s.stats.paid - lastPaid, dd = s.stats.dropped - lastDropped;
    rows.push({
      t: Math.round(t),
      ret: +(dp / Math.max(1, dd)).toFixed(3),
      tbl: s.coins.length,
      plate: s.countOnPlate(),
      mx: s.stats.maxLayer
    });
    lastPaid = s.stats.paid; lastDropped = s.stats.dropped;
  }
}
console.log(JSON.stringify({ aim, secs, seed, every, window: WINDOW }));
for (const r of rows) console.log(`  t=${String(r.t).padStart(5)}  ret=${String(r.ret).padEnd(6)} bed=${String(r.tbl).padStart(3)} plate=${String(r.plate).padStart(2)} mx=${r.mx}`);
const late = rows.slice(-3);
console.log('late mean ret:', +(late.reduce((a, r) => a + r.ret, 0) / Math.max(1, late.length)).toFixed(3));
