// Screenshots: phone (390x844) main row, settings page with live data,
// settings page mid-confirm (armed), and the post-reset world.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (n, d) => {
  const m = process.argv.find(a => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : d;
};
const W = +arg('w', 390), H = +arg('h', 844);
const OUT = arg('out', 'tools/out');
const SHELL = arg('shell',
  'C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe');
const URL_ = 'file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 400);

const child = spawn(SHELL, [
  '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let wsUrl = null;
child.stderr.on('data', b => { const m = /ws:\/\/[^\s]+/.exec(b.toString()); if (m) wsUrl = m[0]; });

async function main() {
  for (let i = 0; i < 100 && !wsUrl; i++) await sleep(100);
  const ws = new WebSocket(wsUrl);
  const waiters = new Map(); const logs = []; let sessionId = null;
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') logs.push('PAGEERROR ' +
      (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  });
  await new Promise(r => ws.addEventListener('open', r));
  let nextId = 1;
  const send = (method, params = {}, sid) => new Promise(res => {
    const id = nextId++; waiters.set(id, res);
    ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
  });
  await send('Target.setDiscoverTargets', { discover: true });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const att = await send('Target.attachToTarget', { targetId, flatten: true });
  sessionId = att.result.sessionId;
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: true }, sessionId);

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate',
      { expression: `(function(){${expr}})()`, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.result?.exceptionDetails) return 'EVALERROR ' + r.result.exceptionDetails.text + ' ' +
      (r.result.exceptionDetails.exception?.description || '');
    return r.result?.result?.value ?? null;
  };
  const shot = async (name) => {
    const cap = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    mkdirSync(dirname(`${OUT}/${name}`), { recursive: true });
    writeFileSync(`${OUT}/${name}`, Buffer.from(cap.result.data, 'base64'));
    return `${OUT}/${name}`;
  };

  await send('Page.navigate', { url: URL_ }, sessionId);
  await sleep(4200);

  // dismiss the start card so the HUD is visible
  await ev(`document.getElementById('sGo').click(); return 1`);
  await sleep(600);

  // give the machine a run worth losing: stage 3, coins, a few props
  await ev(`
    var b = window.__bot, S = window.UI.state;
    S.collected = { sodaCase: 1, lapSapChung: 1, dingDing: 1, crtTv: 1, ferry: 1,
                    tram: 1, daiPaiDong: 1, iceCreamVan: 1, redVan: 1, starFerry: 1,
                    paperFan: 1, milkTea: 1, kanjiSign: 1, plasticFlower: 1, toyGun: 1,
                    cassette: 1, pager: 1, tamagotchi: 1, vcd: 1, minidisc: 1,
                    nokia3310: 1, oBike: 1, karaokeMic: 1, neonSign: 1, fishBall: 1,
                    eggTart: 1, pineappleBun: 1, milkBottle: 1, sodaPop: 1, octopus: 1,
                    hp8: 1, on9: 1, mysim: 1, tie: 1, streetSign: 1, mahjong: 1,
                    chauGong: 1, melon: 1, nokiaN95: 1, easinet: 1, podcast: 1,
                    lens: 1, tehTar: 1, skateboard: 1, gong: 1, lantern: 1,
                    suitcase: 1, handFan: 1, tvb: 1, kpop: 1, eft: 1, nintendo: 1,
                    philips: 1, wongTaiSin: 1, lightbulb: 1, busStop: 1, hsbc: 1,
                    jockey: 1, pigeon: 1, bao: 1, chef: 1, banknote: 1, stamp: 1,
                    reciept: 1 };
    S.found = Object.keys(S.collected);
    S.storySeen = { '0_1': 1, '0_2': 1, '0_3': 1, '1_1': 1, '1_2': 1, '2_1': 1, '2_2': 1 };
    b.applyStage(4, true);
    S.stageIdx = 4;
    S.coins = 631;
    window.UI.setCoins(631);
    window.UI.setBigCount(window.CONTENT.STAGES[4]);
    window.UI.save();
    return 1;
  `);
  await sleep(700);
  const main = await shot('phone-main.png');

  await ev(`document.getElementById('settingsBtn').click(); return 1`);
  await sleep(320);
  const settings = await shot('phone-settings.png');

  await ev(`document.getElementById('settingsReset').click(); return 1`);
  await sleep(320);
  const armed = await shot('phone-settings-armed.png');

  const armedText = await ev(`
    return JSON.stringify({
      resetText: document.getElementById('settingsReset').textContent,
      what: document.getElementById('resetWhat').textContent,
      muted: window.UI.isMuted(),
      fatal: 0
    });
  `);

  // let it auto-disarm, then really reset and photograph the fresh world
  await sleep(3400);
  await ev(`
    var b = document.getElementById('settingsReset');
    b.click(); b.click();
    document.getElementById('settingsClose').click();
    return 1;
  `);
  await sleep(900);
  const fresh = await shot('phone-after-reset.png');
  const freshState = await ev(`
    var p = JSON.parse(window.__probe());
    return JSON.stringify({ stage: p.stage, year: document.getElementById('year').textContent,
      wallet: p.wallet, collected: p.collected, coins: document.getElementById('coins').textContent,
      save: localStorage.getItem('yatmangai.save.v1') });
  `);

  console.log(JSON.stringify({ logs, shots: { main, settings, armed, fresh },
    armedText, freshState }, null, 2));
  ws.close(); child.kill(); process.exit(0);
}
main().catch(e => { console.error('HARNESS FAIL', e.message, e.stack); child.kill(); process.exit(1); });
