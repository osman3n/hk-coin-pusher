import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL='https://osman3n.github.io/hk-coin-pusher/?bot';
const PORT=9930+Math.floor(Math.random()*60);
const proc=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ver; for(let i=0;i<60;i++){try{ver=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();break;}catch{await sleep(250);} }
const ws=new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const wait=new Map(); const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.method==='Runtime.exceptionThrown') errs.push('EXC '+String(m.params.exceptionDetails?.exception?.description||'').slice(0,160));
  if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
const send=(m,p={},s)=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p,...(s?{sessionId:s}:{})}));});
const t=await send('Target.createTarget',{url:'about:blank'});
const a=await send('Target.attachToTarget',{targetId:t.result.targetId,flatten:true});
const sid=a.result.sessionId;
await send('Page.enable',{},sid); await send('Runtime.enable',{},sid);
await send('Page.navigate',{url:URL},sid);
await sleep(9000);
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true},sid);
  if(r.result?.exceptionDetails) return 'THROW:'+String(r.result.exceptionDetails.exception?.description||'').slice(0,160);
  return r.result?.result?.value;};
console.log('LIVE-start-story', await ev(`(function(){var w=document.getElementById('sStory');
  return JSON.stringify({visible:!!w&&getComputedStyle(w).display!=='none',
   title:(document.getElementById('sStoryTitle')||{}).textContent});})()`));
for(let i=0;i<15;i++){await ev("document.getElementById('sGo').click()");if(await ev('window.__bot && __bot.state.started'))break;await sleep(500);}
console.log('LIVE-slap', await ev(`document.getElementById('slapBtn').textContent.trim()`));
console.log('LIVE-physics', await ev(`(function(){var r=__bot.advance(120,{dropAt:0,every:1.1});var S=window.Sim;
  return JSON.stringify({t:r.t,paid:S.stats.paid,lost:S.stats.lost,top:S.countTier('top'),bottom:S.countTier('bottom'),
   floorY:S.FLOOR_Y,fallY:S.fall.map(function(c){return +c.fy.toFixed(3)})});})()`));
console.log('LIVE-floor-pose', await ev(`JSON.stringify(window.R.debugFall())`));
await ev("window.UI.showCard('crtTv')"); await sleep(400);
await ev("var c=document.getElementById('cardClose'); if(c)c.click();"); await sleep(250);
console.log('LIVE-museum', await ev(`(function(){window.UI.openMuseum();
  var t=document.querySelectorAll('#museumGrid [data-id]');
  var u=Array.prototype.filter.call(t,function(x){return x.getAttribute('aria-hidden')!=='true'});
  if(u[0])u[0].click();
  var d=document.getElementById('museumDetail'); var x=d?d.innerText:'';
  return JSON.stringify({tiles:t.length,unlocked:u.length,len:x.length,
   use:x.indexOf('當年點用')>=0,fact:x.indexOf('冷知識')>=0});})()`));
const s=await send('Page.captureScreenshot',{format:'png'},sid);
writeFileSync('shots/live-final.png',Buffer.from(s.result.data,'base64'));
console.log('LIVE-ERRORS', JSON.stringify(errs.slice(0,5)));
ws.close(); proc.kill();
