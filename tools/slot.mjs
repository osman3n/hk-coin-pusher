import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = { Math, console }; win.window = win; vm.createContext(win);
vm.runInContext(readFileSync(`${root}/content.js`, 'utf8'), win, { filename: 'content.js' });
vm.runInContext(readFileSync(`${root}/sim.js`, 'utf8'), win, { filename: 'sim.js' });
const { Sim } = win;
for (const payW of [0.40, 0.34, 0.28, 0.24, 0.20]) {
  const s = Sim.create(); s.payW = payW; s.reset(11); s.seedPile(64);
  let paid = 0, dropped = 0, nextDrop = 0;
  s.onPayout = () => paid++;
  for (let i = 0; i < 900 * 120; i++) {
    if (s.t >= nextDrop) { s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45); nextDrop += 1.2; dropped++; }
    s.step(Sim.STEP);
  }
  const l = s.coins.map(c => c.l || 0);
  console.log(JSON.stringify({ payW, returnRate: +(paid / dropped).toFixed(2), lost: s.stats.lost, coins: s.coins.length, maxLayer: l.length ? Math.max(...l) : 0 }));
}
