import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const browser=findPetTestBrowser();assert.ok(browser,'驗收需要Edge/Chrome');
const out=path.resolve('.seer-cache/native-contact');fs.mkdirSync(out,{recursive:true});
const profile=petTestProfile(),proc=launchPetTestBrowser(browser,port,profile),errors=[],records=[];let ws;
try{
 let target;for(let i=0;i<100;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(100);}}
 assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let serial=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>reject(Error('CDP timeout '+method)),180000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));};
 const until=async(expression,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await evaluate(expression).catch(()=>false))return;await sleep(100);}await shot('timeout');throw Error('timeout '+expression+' '+JSON.stringify(await evaluate('({text:document.body.innerText.slice(-800),diag:window.petVisualAudit?.diagnostics()})')));};
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1010,deviceScaleFactor:1,mobile:false});
 // Freeze only the test clock after a rendered frame; Chromium can still paint and capture it.
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const raf=requestAnimationFrame.bind(window),timer=setTimeout.bind(window),pending=[];window.requestAnimationFrame=fn=>raf(t=>{if(window.__contactFreeze)pending.push(()=>raf(fn));else fn(t)});window.setTimeout=(fn,ms,...args)=>timer(()=>{if(window.__contactFreeze)pending.push(()=>timer(fn,0,...args));else typeof fn==='function'?fn(...args):eval(fn)},ms);window.__contactResume=()=>{window.__contactFreeze=false;pending.splice(0).forEach(fn=>fn())};})()`});
 const cases=[['70','','rey70',30],['5043','gaia-godslayer','gaiaGodslayer',150],['5048','','oscarGenesis',100],['5048','oscar-original','oscarOriginal',120]];
 for(const [id,skin,source,frame] of cases.filter(c=>!process.env.CONTACT_ASSET||c[2]===process.env.CONTACT_ASSET))for(const side of ['p1','p2'].filter(s=>!process.env.CONTACT_SIDE||s===process.env.CONTACT_SIDE)){
 const width=side==='p1'?1920:1024;await send('Emulation.setDeviceMetricsOverride',{width,height:side==='p1'?1010:768,deviceScaleFactor:1,mobile:false});
 const q=new URLSearchParams({elf:side==='p1'?id:'70',opponent:side==='p2'?id:'70',p1Skin:side==='p1'?skin:'',p2Skin:side==='p2'?skin:'',tools:'0'});
 await send('Page.navigate',{url:(process.env.CONTACT_TEST_URL||'http://127.0.0.1:3027')+'/tests/fixtures/petBattlePreview.html?'+q});await send('Page.bringToFront');
 await until(`!!window.petBattle && document.querySelectorAll('[data-pet-ready=true]').length===2 && !!document.querySelector('[data-sprite-side=${side}] [data-pet-source=${source}]')`,180000);
 await until("document.querySelectorAll('[data-pet-ready=true][data-pet-sequence=standby]').length===2 && window.petBattle.getState().phase==='p1_select'");await sleep(500);
 await evaluate('document.querySelector("[data-log-toggle][data-active=true]")?.click()');
 let sample;
 // CPU/GPU stalls can skip the requested rendered frame. Retry a fresh action,
 // never accept a recovery frame as contact evidence or change the game clock.
 for(let attempt=1;attempt<=3;attempt++){
 await evaluate(`window.contactCaptured=null;window.contactDone=false;window.contactSeen=false;window.contactTrap?.disconnect();window.contactTrap=new MutationObserver(()=>{const e=document.querySelector('[data-sprite-side=${side}] [data-pet-sequence]');if(e?.dataset.petSequence==='attack'){window.contactSeen=true;const end=+e.dataset.petContactWindow.split(',')[1];if(+e.dataset.petFrame>=${frame}&&+e.dataset.petFrame<=end&&!window.contactCaptured){window.contactCaptured={side:'${side}',width:${width},source:'${source}',attempt:${attempt},...e.dataset,diag:window.petVisualAudit.diagnostics()};window.__contactFreeze=true;}}else if(window.contactSeen)window.contactDone=true;});window.contactTrap.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-pet-frame','data-pet-sequence']});window.petBattle.onSkillSelect('p1',window.petBattle.getState().p1.skills[${side==='p1'?0:2}]);window.petBattle.onSkillSelect('p2',window.petBattle.getState().p2.skills[${side==='p2'?0:2}]);`);
 await until('!!window.contactCaptured || window.contactDone',30000);sample=await evaluate('window.contactCaptured');if(sample)break;
 await until("!window.petBattle.isPresenting() && window.petBattle.getState().phase==='p1_select' && document.querySelectorAll('[data-pet-ready=true][data-pet-sequence=standby]').length===2",30000);
 }
 assert.ok(sample,source+' '+side+' requested contact frame was skipped on three actions');
 await shot(source+'-'+side+'-contact');await evaluate('window.__contactResume()');records.push(sample);fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({records,errors},null,2));
 assert.equal(sample.petSequence,'attack');const overlap=Math.min(14,Number(sample.petRest.split(',')[1])*.1);assert.ok(Math.abs(Number(sample.petContactGap)+overlap)<.15,JSON.stringify(sample));assert.equal(sample.diag.degraded.length,0);console.log(source+' '+side+' '+width+' frame '+sample.petFrame+' gap '+sample.petContactGap);
 await until('!window.petBattle.isPresenting() && window.petBattle.getState().phase==="p1_select"',30000);
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
}finally{fs.writeFileSync(path.join(out,'last-run.json'),JSON.stringify({records,errors},null,2));ws?.close();closePetTestBrowser(proc,profile);}





