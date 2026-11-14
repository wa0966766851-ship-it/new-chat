import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const out=path.resolve('shots/skin-switch');fs.mkdirSync(out,{recursive:true});
const browser=findPetTestBrowser();assert.ok(browser,'需可用瀏覽器，不能跳過視覺驗收');
const listener=(await import('node:net')).createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));const profile=petTestProfile(),proc=launchPetTestBrowser(browser,port,profile),sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
const rows=[],errors=[];
const attackHits={5037:100,5038:110,5039:74,5040:99,5042:44,5043:53,5044:69,5045:95,5046:55,5047:100};
try{
 let target;for(let i=0;i<80;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(250);}}assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let serial=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},30000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async(expression,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){try{const r=await evaluate(expression);if(r)return r;}catch{}await sleep(150);}const debug=await evaluate('({phase:window.petBattle?.getState().phase,turn:window.petBattle?.getState().turnNumber,present:window.petBattle?.isPresenting(),logs:window.petBattle?.getState().logs.slice(-6),text:document.body.innerText.slice(-300)})').catch(e=>String(e));fs.writeFileSync(path.join(out,'timeout.json'),JSON.stringify({expression,debug,errors},null,2));throw Error('timeout '+expression+' '+JSON.stringify(debug));};
 await send('Runtime.enable');await send('Page.enable');

 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:(process.env.SKIN_TEST_URL||'http://127.0.0.1:3026')+'/tests/fixtures/petBattlePreview.html?elf=5043&opponent=5043&tools=0'});
 await until('window.petVisualAudit && document.querySelectorAll(\'[data-pet-ready="true"]\').length===2');
 await evaluate(`window.skinPerf={gaps:[],tasks:[]};let prev=performance.now();window.pulse=setInterval(()=>{const now=performance.now();window.skinPerf.gaps.push(now-prev);prev=now;},20);window.longTasks=new PerformanceObserver(list=>window.skinPerf.tasks.push(...list.getEntries().map(e=>e.duration)));window.longTasks.observe({type:'longtask',buffered:false});`);
 for(const skin of ['gaia-godslayer','gaia-original','gaia-godslayer','gaia-original']){const start=Date.now();await evaluate(`window.petVisualAudit.select('5043',${JSON.stringify(skin)})`);await sleep(100);await until('window.petBattle && document.querySelectorAll(\'[data-pet-ready="true"]\').length===2');rows.push({skin,elapsedMs:Date.now()-start,...await evaluate(`({diagnostics:window.petVisualAudit.diagnostics(),players:Array.from(document.querySelectorAll('[data-pet-ready="true"]')).map(e=>({load:e.dataset.petLoadMs,mount:e.dataset.petMountMs})),maxGap:Math.max(...window.skinPerf.gaps),maxLongTask:Math.max(0,...window.skinPerf.tasks)})`)});console.log('skin',skin,rows.at(-1));}
 for(let i=0;i<8;i++){await evaluate(`window.petVisualAudit.select('5043', '${i%2?'gaia-original':'gaia-godslayer'}')`);await sleep(90);}
 await until('window.petBattle && document.querySelectorAll(\'[data-pet-ready="true"]\').length===2');
 await evaluate("window.petVisualAudit.mode('static')");await sleep(1000);
 const final=await evaluate('({diagnostics:window.petVisualAudit.diagnostics(),canvases:document.querySelectorAll("canvas").length,perf:window.skinPerf})');
 if(process.env.SKIN_SWITCH_LABEL!=='baseline')assert.ok(Math.max(0,...final.perf.tasks)<1200,'切換不應再出現超過1.2秒的長任務');assert.equal(final.canvases,0);assert.ok(final.diagnostics.leases.every(e=>e.users===0));assert.equal(final.diagnostics.degraded.length,0);assert.equal(errors.length,0,JSON.stringify(errors));
 fs.writeFileSync(path.join(out,(process.env.SKIN_SWITCH_LABEL||'result')+'.json'),JSON.stringify({rows,final,errors},null,2));
}finally{ws?.close();closePetTestBrowser(proc,profile);}
