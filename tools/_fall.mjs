/* Does a paid coin actually come to rest on the tray?
 * Drives stepFall with a realistic render-loop dt, the way main.js does.
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

const s = Sim.create();
s.reset(42);
s.seedPile(40);
let paid = 0;
s.onPayout = () => paid++;
const dt = 1 / 120, fdt = +(process.argv[2] || (1 / 60));
const trace = [];
for (let i = 0; i < 60 * 120; i++) {
  if (i % 102 === 0) s.drop((s.rng() - 0.5) * 0.3);
  s.step(dt);
  if (i % 2 === 0) s.stepFall(fdt);
  if (i % 600 === 0) {
    trace.push(s.fall.map(c => [+c.fy.toFixed(3), +c.fz.toFixed(3), +(c.age || 0).toFixed(2)]));
  }
}
console.log('paid', paid, 'fall', s.fall.length);
console.log('TRAY_Y', Sim.TRAY_Y, 'DWELL', Sim.TRAY_DWELL);
console.log(JSON.stringify(s.fall.map(c => ({
  st: c.state, fy: +c.fy.toFixed(3), fz: +c.fz.toFixed(3),
  fvz: +c.fvz.toFixed(4), fvy: +c.fvy.toFixed(3), age: +(c.age || 0).toFixed(2)
})).slice(0, 8)));
console.log('trace', JSON.stringify(trace.slice(0, 4)));
