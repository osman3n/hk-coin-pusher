// tools/singledeck.mjs — headless sweep of the single-deck sim.
//   node tools/singledeck.mjs [--secs=300] [--aim=0] [--dropAt=0] [--every=1.2]
// Runs content.js + sim.js in a vm with a fake window, drops coins at a fixed
// x, and reports the payout economy. No browser, so this is the trustworthy
// number; the headless renderer runs at ~4 FPS and cannot be timed in wall
// clock.
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

export function loadSim() {
  const win = {};
  const ctx = vm.createContext({ window: win, Math, console, Array, Object, Number, JSON, String });

  vm.runInContext(readFileSync(join(ROOT, 'content.js'), 'utf8'), ctx, { filename: 'content.js' });
  vm.runInContext(readFileSync(join(ROOT, 'sim.js'), 'utf8'), ctx, { filename: 'sim.js' });
  return win.Sim;
}

const Sim = loadSim();
const secs = argNum('secs', 300);
const aim = argNum('aim', 0);
const dropAt = argNum('dropAt', 0);
const every = argNum('every', 1.2);
const SEED = argNum('seed', 56);

const s = Sim.create();
s.reset(7);
s.seedPile(SEED);

let dropped = 0, nextDrop = 0, paidOut = 0;
s.onPayout = () => { paidOut++; };
s.onLost = () => {};

const steps = Math.round(secs / Sim.STEP);
for (let i = 0; i < steps; i++) {
  const t = i * Sim.STEP;
  if (t >= nextDrop) { s.drop(aim); dropped++; nextDrop += every; }
  s.step(Sim.STEP);
  if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
}

const hist = s.layerHistogram();
console.log(JSON.stringify({
  secs, aim, seed: SEED, dropped,
  droppedStat: s.stats.dropped,
  paid: s.stats.paid, paidOut,
  lost: s.stats.lost, bigPaid: s.stats.bigPaid,
  returned: +((s.stats.paid / Math.max(1, s.stats.dropped)).toFixed(3)),
  onTable: s.coins.length,
  onPlate: s.countOnPlate(),
  maxLayer: s.stats.maxLayer,
  front: +s.front.toFixed(3),
  hist,
  fall: s.fall.length
}));
