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



 await send('Page.navigate',{url:'http://127.0.0.1:3178/'});
 await until('!!document.querySelector("[aria-label=目前圖鑑]")');
 const setInput=(selector,value)=>evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,'+JSON.stringify(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');
 await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("新增圖鑑")).click()');
 await until('!!document.querySelector(".atlas-dialog input")');await setInput('.atlas-dialog input','快速測試圖鑑');
 await evaluate('document.querySelector(".atlas-dialog form")?.requestSubmit() || document.querySelector("form.atlas-dialog").requestSubmit()');
 await until('document.querySelector("[aria-label=目前圖鑑]").selectedOptions[0].textContent==="快速測試圖鑑"');
 const timing=await evaluate('new Promise(resolve=>{const select=document.querySelector("[aria-label=目前圖鑑]"),start=performance.now();window.atlasWrites=0;const original=window.fetch;window.fetch=(...args)=>{if(args[1]?.method==="PUT")window.atlasWrites++;return original(...args)};select.value=select.options[0].value;select.dispatchEvent(new Event("change",{bubbles:true}));requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({switchMs:performance.now()-start,writes:window.atlasWrites})));})');
 assert.equal(timing.writes,0,'切換不得等待整份存檔寫入');fs.writeFileSync(path.join(out,'navigation.json'),JSON.stringify(timing));
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'multi-book.png'),Buffer.from(shot.data,'base64'));
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('多本圖鑑：介面載入、新增及切換通過');
}finally{ws?.close();closePetTestBrowser(proc,profile);}
