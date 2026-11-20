// Balance sweep: find the payout slot width that keeps the upper deck stocked
// while still returning most of what the player feeds in.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const ctx = vm.createContext({ console, Math, JSON, window: {} });
vm.runInContext(readFileSync(join(root, 'content.js'), 'utf8'), ctx);
vm.runInContext(readFileSync(join(root, 'sim.js'), 'utf8'), ctx);
const Sim = ctx.window.Sim;

const AIM = +(process.env.AIM || 0.10);
function run2(aim, payW, seconds) {
  const s = Sim.create(); s.reset(777); s.payW = payW;
  s.seedPile(56);
  const dt = Sim.STEP, steps = Math.round(seconds / dt);
  let dropT = 0, drops = 0;
  for (let i = 0; i < steps; i++) {
    s.step(dt); s.stepFall(dt);
    dropT += dt;
    if (dropT >= 1.15) { dropT = 0; drops++; s.drop(aim * Math.sin(drops * 2.1)); }
  }
  return { drops, ...s.stats };
}
function run(payW, gunter, seconds) {
  const s = Sim.create();
  s.reset(4321);
  s.payW = payW;
  s.setDeck('top', { scoop: +(process.env.SCOOP || 0.40) });
  if (gunter != null) Sim.DECKS.bottom.gutterZ = gunter;
  s.seedPile(56);
  const dt = Sim.STEP;
  const steps = Math.round(seconds / dt);
  let dropT = 0, drops = 0;
  for (let i = 0; i < steps; i++) {
    s.step(dt); s.stepFall(dt);
    dropT += dt;
    if (dropT >= 1.15) { dropT = 0; drops++; s.drop(AIM * Math.sin(drops * 2.1)); }
  }
  return { drops, ...s.stats, top: s.countTier('top'), bottom: s.countTier('bottom') };
}
console.log('aim    drops paid  ret');
for (const aim of [0.0, 0.10, 0.22, 0.34, 0.46, 0.60]) {
  const r = run2(aim, 0.34, 300);
  console.log([aim.toFixed(2).padStart(4), String(r.drops).padStart(6),
    String(r.paid).padStart(5), (r.paid / r.drops).toFixed(2).padStart(5)].join(' '));
}
