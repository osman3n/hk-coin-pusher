import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL='file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const PORT=9910+Math.floor(Math.random()*80);
const proc=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ver; for(let i=0;i<60;i++){try{ver=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();break;}catch{await sleep(250);} }
const ws=new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const wait=new Map(); const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.method==='Runtime.exceptionThrown') errs.push('EXC '+(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||'').slice(0,200));
  if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
const send=(m,p={},s)=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p,...(s?{sessionId:s}:{})}));});
const t=await send('Target.createTarget',{url:'about:blank'});
const a=await send('Target.attachToTarget',{targetId:t.result.targetId,flatten:true});
const sid=a.result.sessionId;
await send('Page.enable',{},sid); await send('Runtime.enable',{},sid);
await send('Page.navigate',{url:URL},sid);
await sleep(6500);
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true},sid);
  if(r.result?.exceptionDetails) return 'THROW:'+String(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text).slice(0,200);
  return r.result?.result?.value;};
for(let i=0;i<15;i++){await ev("document.getElementById('sGo').click()");if(await ev('window.__bot && __bot.state.started'))break;await sleep(400);}

// collect one prop through the real card path so the museum has an unlocked tile
await ev("window.UI.showCard('crtTv')");
await sleep(500);
await ev("var cb=document.getElementById('cardClose'); if(cb) cb.click();");
await sleep(300);

// R4: museum -> grid -> open the collected tile -> detail
console.log('R4-open', await ev(`(function(){
  window.UI.openMuseum();
  var grid=document.getElementById('museumGrid');
  var tiles=Array.from(grid.querySelectorAll('[data-id]'));
  var unlocked=tiles.filter(function(t){return t.getAttribute('aria-hidden')!=='true';});
  if(unlocked[0]) unlocked[0].click();
  var d=document.getElementById('museumDetail');
  var vis=d && getComputedStyle(d).display!=='none' && !d.hidden;
  var txt=d?(d.innerText||''):'';
  return JSON.stringify({tiles:tiles.length, unlocked:unlocked.length,
    detailOpen:!!vis, len:txt.length,
    hasName:txt.indexOf('大牛龜')>=0, hasUse:txt.indexOf('當年點用')>=0,
    hasFact:txt.indexOf('冷知識')>=0, hasOwner:txt.indexOf('喺邊個手')>=0});
})()`));

// back to grid, then R6 story tab
console.log('R6-back', await ev(`(function(){
  var b=document.getElementById('mdBack'); if(b) b.click();
  var g=document.getElementById('museumGrid');
  return JSON.stringify({gridBack: !!g && !g.hidden});
})()`));
console.log('R6-tab', await ev(`(function(){
  var sb=document.getElementById('mtabStory'); if(!sb) return 'no tab';
  sb.click();
  var st=document.getElementById('museumStory'), gr=document.getElementById('museumGrid');
  return JSON.stringify({storyShown: !!st && !st.hidden, gridHidden: !!gr && gr.hidden});
})()`));
await sleep(400);
console.log('R6-text', await ev(`(function(){
  var st=document.getElementById('museumStory'); if(!st) return 'none';
  var txt=(st.innerText||'');
  var q=(txt.match(/\\uFF1F\\uFF1F\\uFF1F/g)||[]).length;
  return JSON.stringify({len:txt.length, lockedMarks:q,
    hasTitle:txt.indexOf('\\u6A13\\u68AF\\u5E95')>=0,
    has1972:txt.indexOf('1972')>=0,
    head:txt.slice(0,200).split('\\n').filter(Boolean).slice(0,6)});
})()`));
const s1=await send('Page.captureScreenshot',{format:'png'},sid);
writeFileSync('shots/final-story.png',Buffer.from(s1.result.data,'base64'));
console.log('ERRORS', JSON.stringify(errs.slice(0,6)));
ws.close(); proc.kill();
