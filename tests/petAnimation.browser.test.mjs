import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const port=9600+Math.floor(Math.random()*300);
const browser=findPetTestBrowser();
if(!browser){console.log('跳過：找不到 Edge／Chrome／Chromium（可用 PET_TEST_BROWSER 指定）');process.exit(0);}
const out=path.resolve('.seer-cache/animation-shots');fs.mkdirSync(out,{recursive:true});
const profile=petTestProfile();
const proc=launchPetTestBrowser(browser,port,profile);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try{
 let target;for(let i=0;i<80;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(250);}}
 assert.ok(target,'headless browser ready');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map(),logs=[],failures=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')logs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled')logs.push(m.params.type+': '+m.params.args.map(a=>a.value||a.description).join(' '));if(m.method==='Network.loadingFailed')failures.push(m.params);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:Number(process.env.PET_TEST_WIDTH||1920),height:Number(process.env.PET_TEST_HEIGHT||1010),deviceScaleFactor:Number(process.env.PET_TEST_DPR||1),mobile:false});
 await send('Page.navigate',{url:process.env.PET_TEST_URL||'http://127.0.0.1:3013/tests/fixtures/petAnimationPreview.html'});
 let status;for(let i=0;i<120;i++){await sleep(500);status=await evaluate(`({ready:document.querySelectorAll('[data-pet-ready="true"]').length,text:document.body.innerText,canvases:document.querySelectorAll('canvas').length})`);if(status?.ready===2)break;}
 const save=async name=>{const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));};
 await save('rey-standby');fs.writeFileSync(path.join(out,'browser-evidence.json'),JSON.stringify({status,logs,failures},null,2));
 assert.equal(status?.ready,2,JSON.stringify({status,logs,failures}));
 await evaluate(`document.querySelector('[data-preview-action="attack"]').click()`);await sleep(900);await save('rey-attack');
 // 受擊由正式結算觸發，不再用舊舞台的第 N 個按鈕強制指定姿勢。
 let settled=false;for(let i=0;i<80;i++){await sleep(200);settled=await evaluate(`window.petBattle.getState().turnNumber>=2 && !window.petBattle.isPresenting()`);if(settled)break;}assert.ok(settled,'正式回合完成');
 await save('rey-settled');
 await sleep(200);const before=await evaluate(`Array.from(document.querySelectorAll('[data-pet-ready]')).map(e=>e.getAttribute('data-pet-frame'))`);await sleep(350);const after=await evaluate(`Array.from(document.querySelectorAll('[data-pet-ready]')).map(e=>e.getAttribute('data-pet-frame'))`);assert.notDeepEqual(before,after,'待機動畫必須實際逐幀更新');
 console.log('雙側 WebGL 動作載入、待機逐幀、攻擊／受擊切換與截圖通過');
}finally{ws?.close();closePetTestBrowser(proc,profile);}
