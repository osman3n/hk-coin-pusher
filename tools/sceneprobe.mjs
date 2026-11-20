import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PORT=9000+Math.floor(Math.random()*800);
const url='file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const proc=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
let ws,id=0,sessionId=null;const pending=new Map();
for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/version`);const info=await r.json();ws=new WebSocket(info.webSocketDebuggerUrl);break;}catch{await sleep(250);}}
await new Promise(r=>ws.addEventListener('open',r));
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
const send=(method,params={},sid)=>new Promise(r=>{const i=++id;pending.set(i,r);ws.send(JSON.stringify({id:i,method,params,sessionId:sid}));});
const t=await send('Target.createTarget',{url:'about:blank'});
const a=await send('Target.attachToTarget',{targetId:t.result.targetId,flatten:true});
sessionId=a.result.sessionId;
await send('Page.enable',{},sessionId);
await send('Runtime.enable',{},sessionId);
await send('Page.navigate',{url},sessionId);
for(let i=0;i<20;i++){await sleep(700);await send('Runtime.evaluate',{expression:"document.getElementById('sGo')?.click()"},sessionId);
 const r=await send('Runtime.evaluate',{expression:"!!(window.__bot&&window.__bot.state&&window.__bot.state.started)",returnByValue:true},sessionId);
 if(r.result?.result?.value)break;}
await send('Runtime.evaluate',{expression:`setInterval(function(){if(window.__bot&&window.__bot.state.coins>0)window.__bot.dropAt((Math.random()-0.5)*0.18);},850)`},sessionId);
await sleep(28000);
const expr = process.argv[2] || '1';
const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true},sessionId);
console.log(JSON.stringify(r.result?.result?.value ?? r.result, null, 1));
try{ws.send(JSON.stringify({id:++id,method:'Browser.close'}));}catch{}
proc.kill();process.exit(0);
