// tools/spread.mjs — where do the coins actually sit?
//   node tools/spread.mjs [--secs=300] [--aim=0]
// Prints the bed as an ASCII map. The economy question ("why does it pay back
// 100%") is a geometry question: if the heap never reaches the open front
// corners there is nothing to lose coins into, and the machine is a conveyor.
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

const secs = argNum('secs', 300);
const aim = argNum('aim', 0);
const seed = argNum('seed', 90);
const every = argNum('every', 1.2);

const s = Sim.create();
s.reset(7);
s.seedPile(seed);

const T = Sim.TABLE;
const NX = 31, NZ = 22;
const grid = Array.from({ length: NZ }, () => new Array(NX).fill(0));
const xToI = (x) => Math.max(0, Math.min(NX - 1, Math.round((x - T.x0) / (T.x1 - T.x0) * (NX - 1))));
const zToJ = (z) => Math.max(0, Math.min(NZ - 1, Math.round((z - T.z0) / (T.lip - T.z0) * (NZ - 1))));

function snap() {
  for (const row of grid) row.fill(0);
  for (const c of s.coins) grid[zToJ(c.z)][xToI(c.x)]++;
}

let next = 0;
const steps = Math.round(secs / Sim.STEP);
for (let i = 0; i < steps; i++) {
  const t = i * Sim.STEP;
  if (t >= next) { s.drop(aim); next += every; }
  s.step(Sim.STEP);
  if (i % 6 === 0) s.stepFall(Sim.STEP * 6);
}
snap();

console.log(`t=${secs} aim=${aim} bed=${s.coins.length} plate=${s.countOnPlate()} ` +
  `paid=${s.stats.paid} lost=${s.stats.lost} mx=${s.stats.maxLayer}`);
console.log(`front(rib) z=${s.front.toFixed(3)}  dropZ=${Sim.DROP_Z}  payW=${s.payW}  gutterZ=${Sim.DECK.gutterZ}  lip=${T.lip}`);
console.log(`x: ${T.x0.toFixed(2)} .. ${T.x1.toFixed(2)}   z: ${T.z0.toFixed(2)}(back) .. ${T.lip.toFixed(2)}(lip)`);
console.log('');
const lipJ = zToJ(T.lip), gutJ = zToJ(Sim.DECK.gutterZ);
for (let j = NZ - 1; j >= 0; j--) {
  let marker = '';
  if (j === gutJ) marker = ' <- gutter line';
  if (j >= NZ - 2) marker = ' <- lip (pays or dies)';
  console.log(`${(T.z0 + (j / (NZ - 1)) * (T.lip - T.z0)).toFixed(2).padStart(6)} |` +
    grid[j].map((n) => (n === 0 ? ' ' : n > 9 ? '#' : n > 4 ? '+' : '.')).join('') + '|' + marker);
}
console.log('        ' + ' '.repeat(NX) + '  ←x→');
console.log('');
// margin histogram: how the bed is distributed in x, and how many are near the
// open corners where a coin can actually be lost
let edge = 0, mid = 0;
for (const c of s.coins) {
  const m = Math.min(c.x - T.x0, T.x1 - c.x);
  if (m < c.r * 2) edge++; else mid++;
}
console.log(`near-side-edge ${edge}   interior ${mid}`);
