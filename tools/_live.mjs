import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PORT=9100+Math.floor(Math.random()*400);
const URL='https://osman3n.github.io/hk-coin-pusher/?bot';
const p=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--hide-scrollbars','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
let ws,id=0,sid=null,pending=new Map();
const send=(m,pr={},s)=>{const i=++id;ws.send(JSON.stringify({id:i,method:m,params:pr,sessionId:s}));return new Promise(r=>pending.set(i,r));};
for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/version`);const j=await r.json();ws=new WebSocket(j.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);break;}catch(e){await sleep(250);} }
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
({sessionId:sid}=await send('Target.attachToTarget',{targetId,flatten:true}));
await send('Page.navigate',{url:URL},sid); await sleep(6000);
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true},sid);return r.result&&r.result.value;};

console.log('LIVE', await ev(`JSON.stringify({topLip:Sim.TOP.table.lip, topFwd:Sim.TOP.plate.fwd, botPayW:Sim.PAY_W, dwell:Sim.TRAY_DWELL, thumb:(function(){try{return R.thumb('crtTv').length}catch(e){return 'ERR:'+e.message}})()})`));
ws.close(); p.kill(); process.exit(0);
