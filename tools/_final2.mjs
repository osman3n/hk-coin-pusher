import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL='file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const PORT=9900+Math.floor(Math.random()*90);
const proc=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ver; for(let i=0;i<60;i++){try{ver=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();break;}catch{await sleep(250);} }
const ws=new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const wait=new Map(); const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.method==='Runtime.exceptionThrown') errs.push('EXC '+(m.params.exceptionDetails?.text||''));
  if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
const send=(m,p={},s)=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p,...(s?{sessionId:s}:{})}));});
const t=await send('Target.createTarget',{url:'about:blank'});
const a=await send('Target.attachToTarget',{targetId:t.result.targetId,flatten:true});
const sid=a.result.sessionId;
await send('Page.enable',{},sid); await send('Runtime.enable',{},sid);
await send('Page.navigate',{url:URL},sid);
await sleep(6500);
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true},sid);
  if(r.result?.exceptionDetails) return 'THROW:'+(r.result.exceptionDetails.text||'');
  return r.result?.result?.value;};
for(let i=0;i<15;i++){await ev("document.getElementById('sGo').click()");if(await ev('window.__bot && __bot.state.started'))break;await sleep(400);}

// --- R3: slap meter drains and recharges, read from the DOM (what the player sees)
const slapLive = await ev(`(function(){
  var b=document.getElementById('slapBtn'), out=[];
  function snap(tag){ out.push({at:tag, text:b.textContent.trim(),
    aria:b.getAttribute('aria-label'), ad:b.getAttribute('aria-disabled'),
    spent:b.classList.contains('spent'), bar:(b.querySelector('i,span.bar')||{}).style ?
      (b.style.getPropertyValue('--slap')||b.style.getPropertyValue('--p')||'') : ''}); }
  snap('full');
  window.__bot.slap(); window.__bot.advance(0.2,{}); snap('after1');
  window.__bot.advance(4.3,{}); snap('afterRecharge');
  return JSON.stringify(out);
})()`);
console.log('R3-live', slapLive);

// --- R6: open the 故事線 tab and confirm it renders the story rows
const storyTab = await ev(`(function(){
  window.UI.openMuseum();
  var sb=document.getElementById('mtabStory');
  if(!sb) return JSON.stringify({err:'no #mtabStory'});
  sb.click();
  var st=document.getElementById('museumStory'), gr=document.getElementById('museumGrid');
  return JSON.stringify({storyShown: !!st && !st.hidden && getComputedStyle(st).display!=='none',
    gridHidden: !!gr && gr.hidden});
})()`);
console.log('R6-click', storyTab);
await sleep(500);
const storyRows = await ev(`(function(){
  var st=document.getElementById('museumStory');
  var t=(st.innerText||'').replace(/\n+/g,' | ');
  return JSON.stringify({len:t.length, q:((st.innerText||'').match(/\?\?\?/g)||[]).length,
    hasTitle:/樓梯底嗰一蚊/.test(t), hasPremise:/跌入機底嘅嘢冇人執返/.test(t),
    has1972:/1972/.test(t), text:t.slice(0,260)});
})()`);
console.log('R6-rows', storyRows);

// --- R4: back to 藏品, open a collected item's detail
const detail = await ev(`(function(){
  var tabs=Array.from(document.querySelectorAll('#museumTabs button, #museumTabs [role=tab], #museumTabs .tab'));
  var propsBtn=tabs.filter(function(b){return /藏品/.test(b.textContent)})[0];
  if(propsBtn) propsBtn.click();
  var tiles=Array.from(document.querySelectorAll('#museumGrid [data-id]'));
  var locked=0, opener=null;
  tiles.forEach(function(t){ if(t.getAttribute('aria-hidden')==='true') locked++; else if(!opener && t.tagName==='BUTTON') opener=t; });
  if(opener) opener.click();
  var d=document.getElementById('museumDetail');
  return JSON.stringify({tiles:tiles.length, locked:locked, opened: !!d && getComputedStyle(d).display!=='none',
    detailLen: d ? (d.innerText||'').length : 0,
    hasUse:/當年點用/.test(d?d.innerText:''), hasFact:/冷知識/.test(d?d.innerText:'')});
})()`);
console.log('R4-detail', detail);
await sleep(600);
const shot = await send('Page.captureScreenshot',{format:'png'},sid);
writeFileSync('shots/final-museum.png',Buffer.from(shot.result.data,'base64'));
console.log('ERRORS', JSON.stringify(errs.slice(0,6)));
ws.close(); proc.kill();
