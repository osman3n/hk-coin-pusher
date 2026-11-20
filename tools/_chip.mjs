import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const PORT=9100+Math.floor(Math.random()*400);
const URL='file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const p=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--hide-scrollbars','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
let ws,id=0,sid=null,pending=new Map();
const send=(m,pr={},s)=>{const i=++id;ws.send(JSON.stringify({id:i,method:m,params:pr,sessionId:s}));return new Promise(r=>pending.set(i,r));};
for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/version`);const j=await r.json();ws=new WebSocket(j.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);break;}catch(e){await sleep(250);} }
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}};
const {targetId}=await send('Target.createTarget',{url:'about:blank'});
({sessionId:sid}=await send('Target.attachToTarget',{targetId,flatten:true}));
await send('Page.navigate',{url:URL},sid); await sleep(6000);
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true},sid);return r.result&&r.result.value;};
await ev(`document.querySelector('#sGo').click()`); await sleep(1200);
const before=await ev(`document.querySelectorAll('#bigRow .chip').length`);
const got0=await ev(`document.querySelectorAll('#bigRow .chip.got').length`);
// Collect a small item through the real path, and sample the pulse class
// while it is still live (it is removed 950ms after the win).
await ev(`UI.showCard('lapSapChung')`);
const justgot = await ev(`document.querySelectorAll('#bigRow .chip.justgot').length`);
const gotNow = await ev(`document.querySelectorAll('#bigRow .chip.got').length`);
await sleep(400);
const cardName=await ev(`document.querySelector('#cardName').textContent`);
await ev(`document.querySelector('#cardClose').click()`); await sleep(300);
const afterSmall=await ev(`({got:document.querySelectorAll('#bigRow .chip.got').length, count:document.querySelector('#bigCount').textContent})`);
await ev(`UI.showCard('sodaCase')`); await sleep(400);
await ev(`document.querySelector('#cardClose').click()`); await sleep(300);
const afterBig=await ev(`({got:document.querySelectorAll('#bigRow .chip.got').length, count:document.querySelector('#bigCount').textContent, bigGot:document.querySelectorAll('#bigRow .chip.big.got').length})`);
console.log(JSON.stringify({chipCount:before, got0, justgot, gotNow, cardName, afterSmall, afterBig},null,1));
ws.close(); p.kill(); process.exit(0);
