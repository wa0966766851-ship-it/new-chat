import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const out=path.resolve('shots/encyclopedia');fs.mkdirSync(out,{recursive:true});
const browser=findPetTestBrowser();assert.ok(browser,'需可用瀏覽器，不能跳過視覺驗收');
const listener=(await import('node:net')).createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));const profile=petTestProfile(),proc=launchPetTestBrowser(browser,port,profile),sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
const rows=[],errors=[];
try{
 let target;for(let i=0;i<80;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(250);}}assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let serial=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},30000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async(expression,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){try{const r=await evaluate(expression);if(r)return r;}catch{}await sleep(150);}const debug=await evaluate('({phase:window.petBattle?.getState().phase,turn:window.petBattle?.getState().turnNumber,present:window.petBattle?.isPresenting(),logs:window.petBattle?.getState().logs.slice(-6),text:document.body.innerText.slice(-300)})').catch(e=>String(e));fs.writeFileSync(path.join(out,'timeout.json'),JSON.stringify({expression,debug,errors},null,2));throw Error('timeout '+expression+' '+JSON.stringify(debug));};
 await send('Runtime.enable');await send('Page.enable');




 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:3178/?export=1&book=naifen&elf=atlas_naifen'});
 await until('document.querySelectorAll("[data-rich-depth]").length>10 && !!document.querySelector(".spot-body")');
 const rows=await evaluate('[...document.querySelectorAll("[data-rich-depth]")].map(e=>({depth:Number(e.dataset.richDepth),display:getComputedStyle(e).display,padding:parseFloat(getComputedStyle(e).paddingInlineStart),width:e.getBoundingClientRect().width,text:e.textContent.slice(0,30)}))');
 assert.ok(rows.some(r=>r.depth>=3));assert.ok(rows.every(r=>r.display==='block'));assert.ok(rows.filter(r=>r.depth>0).every(r=>r.padding===r.depth*16));
 await until('document.querySelector(".spot-body").complete && document.querySelector(".spot-body").naturalWidth>0');
 const src=await evaluate('document.querySelector(".spot-body").getAttribute("src")');assert.equal(src,'/seer/body/264.png');
 fs.writeFileSync(path.join(out,'naifen-hierarchy.json'),JSON.stringify({src,rows},null,2));
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1440,height:await evaluate('document.querySelector(".atlas-export").scrollHeight'),scale:1}});fs.writeFileSync(path.join(out,'naifen-hierarchy.png'),Buffer.from(shot.data,'base64'));
 assert.equal(errors.length,0);console.log('奈尼芬多逐行／三層以上縮排／素材來源驗證通過');
}finally{ws?.close();closePetTestBrowser(proc,profile);}
