import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = { Math, console };
win.window = win;
vm.createContext(win);
for (const f of ['content.js', 'sim.js']) vm.runInContext(readFileSync(`${root}/${f}`, 'utf8'), win, { filename: f });
const C = win.CONTENT, Sim = win.Sim;

// Can a HEAVY prop ever be pushed off the lip, or do props just wall up?
const s = Sim.create(); s.reset(5); s.seedPile(70);
const propId = 'crtTv';
const p = s.spawn(0, 0.05, 'prop', propId);
p.fallT = 0;
let paidAt = -1, paidKind = null;
s.onPayout = c => { if (c.kind === 'prop') paidAt = s.t; };
s.onBigPayout = c => { if (c.kind === 'prop') paidAt = s.t; };
for (let i = 0; i < 120 * 90 && paidAt < 0; i++) {
  if (i % 240 === 0) s.drop(((i * 37) % 100) / 100 * 0.8 - 0.4);
  s.step(Sim.STEP);
}
console.log('prop', propId, 'r=' + p.r, 'm=' + p.m);
console.log('paid at t=', paidAt.toFixed(2), 's  (final z=' + p.z.toFixed(3) + ' state=' + p.state + ')');
console.log('table coins', s.coins.length, 'hist', JSON.stringify(s.layerHistogram()));

// Big props too
for (const id of ['neonSign', 'mahjongTable', 'arcadeCab']) {
  const s2 = Sim.create(); s2.reset(9); s2.seedPile(80);
  const q = s2.spawn(0, 0.06, 'prop', id);
  q.fallT = 0;
  let done = -1;
  s2.onBigPayout = () => { done = s2.t; };
  s2.onPayout = () => { };
  for (let i = 0; i < 120 * 120 && done < 0; i++) {
    if (i % 200 === 0) s2.drop(((i * 53) % 100) / 100 * 0.8 - 0.4);
    s2.step(Sim.STEP);
  }
  console.log(' ', id, 'r=' + q.r, 'paidAt=', done < 0 ? 'NEVER' : done.toFixed(2) + 's', 'z=' + q.z.toFixed(3));
}
