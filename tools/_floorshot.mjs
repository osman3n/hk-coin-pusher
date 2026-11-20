import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const SHELL='C:/Users/osman_lam/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL='file:///C:/Users/osman_lam/Projects/WebGame/Coin%20Pusher/index.html?bot';
const PORT=9700+Math.floor(Math.random()*100);
const proc=spawn(SHELL,['--headless','--disable-gpu','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${PORT}`,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ver; for(let i=0;i<60;i++){try{ver=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();break;}catch{await sleep(250);} }
const ws=new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const wait=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);}};
const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
const t=await send('Target.createTarget',{url:'about:blank'});
const a=await send('Target.attachToTarget',{targetId:t.result.targetId,flatten:true});
const sid=a.result.sessionId;
await send('Page.enable',{},sid); await send('Runtime.enable',{},sid);
await send('Page.navigate',{url:URL},sid);
await sleep(6000);
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true},sid);return r.result?.result?.value;};
// start
for(let i=0;i<15;i++){await ev("document.getElementById('sGo').click()");if(await ev('window.__bot && __bot.state.started'))break;await sleep(400);}
// advance physics so coins reach the floor
await ev(`__bot.advance(150,{dropAt:0,every:1.1})`);
// park the camera close to the floor landing patch
await ev(`(function(){
  var R=window.R, S=window.Sim;
  R.camera.position.set(0.0, 0.10, 1.05);
  R.camera.lookAt(0, -0.30, 0.35);
  R.camera.updateMatrixWorld();
  return R.camera.position.toArray();
})()`);
await sleep(900);
const info=await ev(`JSON.stringify(window.__probe())`);
console.log('PROBE', info);
const dbg=await ev(`JSON.stringify(window.R.debugFall())`);
console.log('FALL', dbg);
const rot=await ev(`(function(){
  var out=[];
  var sim=window.Sim;
  if(!sim) return 'no sim';
  sim.fall.slice(0,3).forEach(function(fc){
    out.push({kind:fc.kind, fy:+fc.fy.toFixed(4), fax:+(fc.fax||0).toFixed(4), faz:+(fc.faz||0).toFixed(4), r:fc.r});
  });
  return JSON.stringify(out);
})()`);
console.log('FALLRAW', rot);
const meshrot=await ev(`(function(){
  var R=window.R; var out=[];
  if(!R.debugFallMeshes) return 'none';
  return 'x';
})()`);
console.log('MESHROT', meshrot);
const s=await send('Page.captureScreenshot',{format:'png'},sid);
writeFileSync('shots/feel/_floorclose.png',Buffer.from(s.result.data,'base64'));
console.log('shot');
ws.close(); proc.kill();
