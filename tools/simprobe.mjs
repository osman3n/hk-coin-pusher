/* Load sim.js outside a browser and measure payout throughput.
 * Answers one question: with N coins on the table and the plate sweeping,
 * how long until a coin crosses the lip?
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const win = { CONTENT: { PROPS: {} }, Math, performance, console };
win.window = win;
vm.createContext(win);
for (const f of ['content.js', 'sim.js']) {
  vm.runInContext(readFileSync(`${root}/${f}`, 'utf8'), win, { filename: f });
}

const Sim = win.Sim;
console.log('TABLE', JSON.stringify(Sim.TABLE), 'PLATE', JSON.stringify(Sim.PLATE));
console.log('STEP', Sim.STEP, 'COIN_R', Sim.COIN_R);

function run(seedN, drops, seconds) {
  const s = Sim.create();
  s.reset(42);
  s.seedPile(seedN);
  let paid = 0;
  s.onPayout = () => paid++;
  const steps = Math.round(seconds / Sim.STEP);
  let maxZ = -9;
  const dropEvery = Math.floor(steps / Math.max(1, drops));
  for (let i = 0; i < steps; i++) {
    if (drops && i % dropEvery === 0) s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45);
    s.step(Sim.STEP);
    for (const c of s.coins) if (c.z > maxZ) maxZ = c.z;
  }
  return {
    seedN, drops, coins: s.coins.length, paid,
    maxZ: +maxZ.toFixed(3),
    hist: s.layerHistogram(),
    nearLip: s.coins.filter(c => c.z > 0.20).length,
    pastLip: s.coins.filter(c => c.z > Sim.TABLE.lip).length,
    plateFront: +s.plateFront.toFixed(3)
  };
}

console.log('\n-- no drops, just the seeded pile, 30s --');
for (const n of [20, 40, 56, 80]) console.log(JSON.stringify(run(n, 0, 30)));

console.log('\n-- 45 drops over 60s --');
for (const n of [20, 40, 56]) console.log(JSON.stringify(run(n, 45, 60)));

// How far does a single coin travel per stroke in an empty table?
{
  const s = Sim.create(); s.reset(1); s.seedPile(0);
  const c = s.spawn(0, -0.15, 'coin'); c.fallT = 0;
  const zs = [];
  for (let i = 0; i < 400; i++) {
    s.step(Sim.STEP);
    if (i % 40 === 0) zs.push(+c.z.toFixed(3));
  }
  console.log('\nsingle coin z over time:', JSON.stringify(zs), 'state', c.state);
}
