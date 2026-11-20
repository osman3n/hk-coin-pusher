// Sweep top-deck geometry to find a shape where the upper tray visibly keeps
// coins instead of acting as a conveyor belt straight to the bottom deck.
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

function run(cfg, seconds) {
  const s = Sim.create();
  s.setDeck('top', cfg);
  s.reset(1234);
  s.seedPile(56);
  const dt = Sim.STEP;
  let dropT = 0;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    s.step(dt);
    s.stepFall(dt);
    dropT += dt;
    if (dropT >= 1.15) { dropT = 0; s.drop((i * 7919 % 100) / 100 - 0.5); }
  }
  return {
    top: s.countTier('top'),
    bottom: s.countTier('bottom'),
    paid: s.stats.paid, lost: s.stats.lost, shuttled: s.stats.shuttled,
    maxLayer: s.stats.maxLayer
  };
}

const cfgs = [];
for (const payW of [0.26, 0.28, 0.30, 0.32]) {
  for (const lip of [-0.16, -0.14, -0.12]) {
    for (const fwd of [-0.34, -0.32]) {
      cfgs.push({ lip, fwd, period: 2.15, payW });
    }
  }
}
console.log('lip    fwd    payW   top  bottom  paid  lost  shut  layer  ret');
for (const c of cfgs) {
  const r = run(c, 240);
  const ret = (r.paid / 208).toFixed(2);
  console.log(
    [c.lip.toFixed(2).padStart(5), c.fwd.toFixed(2).padStart(6),
     c.payW.toFixed(2).padStart(6), String(r.top).padStart(4),
     String(r.bottom).padStart(7), String(r.paid).padStart(5),
     String(r.lost).padStart(5), String(r.shuttled).padStart(5),
     String(r.maxLayer).padStart(5), ret.padStart(5)].join(' '));
}
