import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = { CONTENT: { PROPS: {} }, Math, console };
win.window = win;
vm.createContext(win);
for (const f of ['content.js', 'sim.js']) vm.runInContext(readFileSync(`${root}/${f}`, 'utf8'), win, { filename: f });
const Sim = win.Sim;

// Where do coins actually die? Track terminal z of every paid coin.
const s = Sim.create(); s.reset(42); s.seedPile(56);
let paid = 0, paidZ = [], paidL = [];
s.onPayout = c => { paid++; paidZ.push(+c.z.toFixed(3)); paidL.push(c.l); };
for (let i = 0; i < 120 * 120; i++) {
  if (i % 160 === 0 && i < 120 * 90) s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45);
  s.step(Sim.STEP);
}
console.log('120s, ~67 drops: paid', paid, 'coins left', s.coins.length);
console.log('paid z range', Math.min(...paidZ), Math.max(...paidZ));
console.log('paid layers', JSON.stringify(paidL.slice(0, 30)));
console.log('hist', JSON.stringify(s.layerHistogram()));

// win rate: coins paid per coin dropped
console.log('return rate', (paid / 67).toFixed(2), 'coins out per coin in');
