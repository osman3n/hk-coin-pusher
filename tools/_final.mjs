import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL='file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const PORT=9800+Math.floor(Math.random()*90);
const proc=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ver; for(let i=0;i<60;i++){try{ver=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();break;}catch{await sleep(250);} }
const ws=new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const wait=new Map(); const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.method==='Runtime.exceptionThrown') errs.push('EXC '+(m.params.exceptionDetails?.text||'')+' '+(m.params.exceptionDetails?.exception?.description||'').slice(0,140));
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error') errs.push('ERR '+(m.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,140));
  if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
const t=await send('Target.createTarget',{url:'about:blank'});
const a=await send('Target.attachToTarget',{targetId:t.result.targetId,flatten:true});
const sid=a.result.sessionId;
await send('Page.enable',{},sid); await send('Runtime.enable',{},sid);
await send('Page.navigate',{url:URL},sid);
await sleep(6500);
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true},sid);
  if(r.result?.exceptionDetails) return 'THROW:'+(r.result.exceptionDetails.text||'');
  return r.result?.result?.value;};

// --- R6: story on the start screen, before any play
const startStory = await ev(`(function(){
  var w=document.getElementById('sStory');
  var vis = w && getComputedStyle(w).display!=='none' && getComputedStyle(w).opacity!=='0';
  return JSON.stringify({visible:!!vis, title:(document.getElementById('sStoryTitle')||{}).textContent,
    premiseLen:((document.getElementById('sStoryPremise')||{}).textContent||'').length});
})()`);
console.log('R6-start-story', startStory);

// start
for(let i=0;i<15;i++){await ev("document.getElementById('sGo').click()");if(await ev('window.__bot && __bot.state.started'))break;await sleep(400);}

// --- R3: slap meter renders budget
const slap0 = await ev(`(function(){ var b=document.getElementById('slapBtn');
  return JSON.stringify({text:b.textContent.trim(), aria:b.getAttribute('aria-label'), disabled:b.getAttribute('aria-disabled')});})()`);
console.log('R3-slap-full', slap0);
await ev(`window.__bot.advance(1,{})`);
await ev(`window.__bot.slap()`);
await ev(`window.__bot.advance(0.1,{})`);
const slap1 = await ev(`window.UI.slapState && JSON.stringify(window.__probe().slap)`);
console.log('R3-slap-after-one', slap1);

// --- R1/R2: run real physics, watch a coin land on top deck then reach the floor
const topLanding = await ev(`(function(){
  var S=window.Sim, seen={onTop:0, onFloor:0, maxTierTop:0};
  // drop a coin and watch its tier over time
  __bot.dropAt(0);
  var steps=0, started=false, landedTop=false;
  while(steps++ < 240){ S.step(S.STEP); }
  return JSON.stringify({topCount:S.countTier('top'), botCount:S.countTier('bottom'), stats:S.stats});
})()`);
console.log('R1-drop-top-deck', topLanding);

const heavy = await ev(`(function(){
  var r = __bot.advance(120,{dropAt:0,every:1.1});
  var S=window.Sim;
  return JSON.stringify({t:r.t, stats:S.stats, fall:S.fall.length,
    fallY:S.fall.map(function(c){return +c.fy.toFixed(3)}),
    floorY:S.FLOOR_Y, top:S.countTier('top'), bottom:S.countTier('bottom')});
})()`);
console.log('R2-floor', heavy);

// --- R4: museum grid + detail + story tab
const museum = await ev(`(function(){
  window.UI.openMuseum();
  var tiles=document.querySelectorAll('#museumGrid .tile, #museumGrid [data-id]');
  var tabs=document.getElementById('museumTabs');
  return JSON.stringify({tiles:tiles.length, tabsShown: !!tabs && getComputedStyle(tabs).display!=='none'});
})()`);
console.log('R4-museum', museum);
const storyTab = await ev(`(function(){
  var btns=Array.from(document.querySelectorAll('#museumTabs button, #museumTabs [role=tab]')).map(b=>b.textContent.trim());
  var st=document.querySelectorAll('#museumGrid .storyRow, #museumGrid [data-story]');
  return JSON.stringify({tabLabels:btns, storyRows:st.length});
})()`);
console.log('R6-museum-tabs', storyTab);
await ev(`window.UI.closeMuseum && window.UI.closeMuseum()`);

const shot = await send('Page.captureScreenshot',{format:'png'},sid);
writeFileSync('shots/final-desktop.png',Buffer.from(shot.result.data,'base64'));
console.log('ERRORS', JSON.stringify(errs.filter(e=>!/favicon/.test(e)).slice(0,8)));
ws.close(); proc.kill();
