/* Does aiming matter? The payout slot is the game's skill axis: coins that
 * leave near the centre should be paid, coins near the rails should be scrap.
 * If centre and edge aim return the same rate, the slot is decoration. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = { Math, console }; win.window = win; vm.createContext(win);
vm.runInContext(readFileSync(`${root}/content.js`, 'utf8'), win, { filename: 'content.js' });
vm.runInContext(readFileSync(`${root}/sim.js`, 'utf8'), win, { filename: 'sim.js' });
const { Sim } = win;

function run(aimFn, secs = 420) {
  const s = Sim.create(); s.reset(11); s.seedPile(110);
  let paid = 0, dropped = 0, nextDrop = 0;
  s.onPayout = () => paid++;
  for (let i = 0; i < secs * 120; i++) {
    if (s.t >= nextDrop) {
      // small aim error, like a human
      s.drop(aimFn() + (Math.random() - 0.5) * 0.04);
      nextDrop += 1.1; dropped++;
    }
    s.step(Sim.STEP);
  }
  const l = s.coins.map(c => c.l || 0);
  return {
    ret: +(paid / dropped).toFixed(2),
    lost: s.stats.lost,
    coins: s.coins.length,
    maxLayer: l.length ? Math.max(...l) : 0,
  };
}

const T = Sim.TABLE, payW = Sim.PAY_W;
console.log('table x', T.x0, T.x1, 'payW', payW);
const cases = {
  'centre  x=0'      : () => 0,
  'halfway x=0.50*W' : () => payW * 0.5,
  'edge    x=0.95*W' : () => payW * 0.95,
  'outside x=1.35*W' : () => payW * 1.35,
  'rails   x=1.7*W'  : () => Math.min(T.x1 - 0.06, payW * 1.7),
};
for (const [name, fn] of Object.entries(cases)) {
  console.log(JSON.stringify({ aim: name, ...run(fn) }));
}
