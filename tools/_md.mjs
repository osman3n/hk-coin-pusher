import { writeFileSync } from 'node:fs';
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
await ev(`UI.showCard('crtTv')`); await sleep(700);
await ev(`var c=document.getElementById('cardClose'); if(c)c.click();`); await sleep(600);
await ev(`UI.openMuseum()`); await sleep(700);
console.log('DETAIL', await ev(`(function(){
  var tiles=document.querySelectorAll('#museumGrid .mu');
  var got=null; tiles.forEach(function(t){ if(!got && t.getAttribute('aria-hidden')!=='true' && t.tagName==='BUTTON') got=t; });
  got.click();
  var d=document.getElementById('museumDetail');
  var t=d.textContent.split(String.fromCharCode(10)).join(' ').replace(/[ ]{2,}/g,' ').trim();
  return JSON.stringify({len:t.length, text:t.slice(0,160)});
})()`));
await sleep(600);
console.log('EMPTY_BLOCKS', await ev(`(function(){
  var d=document.getElementById('museumDetail');
  var out=[];
  d.querySelectorAll('div[id], section, p').forEach(function(e){
    if(e.id && e.id.indexOf('Wrap')>0) out.push(e.id+':'+(e.hidden?'hidden':'SHOWN')+':'+e.textContent.trim().length);
  });
  return JSON.stringify(out);
})()`));
console.log('LOCKED', await ev(`(function(){
  UI.closeMuseumDetail();
  var tiles=document.querySelectorAll('#museumGrid .mu');
  var leak=[];
  tiles.forEach(function(t){
    if(t.getAttribute('aria-hidden')==='true'){
      var tx=t.textContent.trim();
      if(tx.indexOf(String.fromCharCode(65311))<0 && tx.indexOf('?')<0) leak.push(tx);
    }
  });
  return JSON.stringify({locked:tiles.length-1, realNamesLeaked:leak.length, sample:leak.slice(0,3)});
})()`));
const shot = await send('Page.captureScreenshot',{format:'png'},sid);
writeFileSync('shots/_md.png', Buffer.from(shot.data,'base64'));
console.log('shot');
ws.close(); p.kill(); process.exit(0);
