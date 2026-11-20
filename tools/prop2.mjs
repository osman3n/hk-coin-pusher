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

const smallId = Object.keys(C.PROPS).find(k => !C.PROPS[k].big);
const bigId = Object.keys(C.PROPS).find(k => C.PROPS[k].big);
console.log('smallId', smallId, JSON.stringify({ m: C.PROPS[smallId].weight, r: C.PROPS[smallId].radius }));
console.log('bigId  ', bigId, JSON.stringify({ m: C.PROPS[bigId].weight, r: C.PROPS[bigId].radius }));

const s = Sim.create(); s.reset(11); s.seedPile(64);
const a = s.spawn(-0.20, -0.30, 'prop', smallId); a.fallT = 0;
const b = s.spawn(0.20, -0.32, 'prop', bigId); b.fallT = 0;
console.log('spawned a at', a.z, 'b at', b.z);

const trail = [];
for (let i = 0; i < 120 * 60; i++) {
  if (i % 150 === 0) s.drop(((i * 37) % 100) / 100 * 0.9 - 0.45);
  s.step(Sim.STEP);
  if (i % 300 === 0) trail.push(`t=${s.t.toFixed(0)} a.z=${a.z.toFixed(3)} l=${a.l} b.z=${b.z.toFixed(3)} l=${b.l} plate=${s.plateFront.toFixed(3)}`);
}
console.log(trail.join('\n'));
console.log('final a', a.z.toFixed(3), a.state, 'b', b.z.toFixed(3), b.state);
console.log('lip', Sim.TABLE.lip);
console.log('coin z distribution', JSON.stringify(
  s.coins.reduce((acc, c) => { const k = Math.floor(c.z * 10) / 10; acc[k] = (acc[k] || 0) + 1; return acc; }, {})
));
