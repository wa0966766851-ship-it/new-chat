import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=async()=>{const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;};
const out=path.resolve('shots/encyclopedia');fs.mkdirSync(out,{recursive:true});
const active=JSON.parse(fs.readFileSync('encyclopedia/.releases/active.json'));
const dist=path.resolve('encyclopedia/.releases',active.id);
const debugPort=await freePort(),profile=petTestProfile(),browser=findPetTestBrowser();assert.ok(browser);
const proc=launchPetTestBrowser(browser,debugPort,profile),servers=[];let ws;
try{
 let target;for(let i=0;i<100;i++){try{target=await(await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(100);}}
 assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let serial=0;const pending=new Map(),requests=[],errors=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>reject(Error('CDP timeout '+method)),30000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression).catch(()=>false))return;await sleep(100);}throw Error('Timeout '+expression+' '+await evaluate('document.body.innerText.slice(0,600)'));};
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
 for(const blank of [false,true]){
  const port=await freePort(),data=path.resolve('.seer-cache','atlas-loading-'+(blank?'blank':'standard')+'-'+Date.now());
  const catalog=path.join(data,'catalog');fs.mkdirSync(data,{recursive:true});fs.cpSync(path.join(dist,'catalog'),catalog,{recursive:true});
  const server=spawn(process.execPath,[path.join(dist,'server.mjs')],{windowsHide:true,stdio:'ignore',env:{...process.env,ATLAS_ROOT:process.cwd(),ATLAS_DIST:dist,ATLAS_CATALOG_DIR:catalog,ATLAS_PORT:String(port),ATLAS_DATA_DIR:data,ATLAS_BLANK:blank?'1':'0'}});servers.push(server);
  const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<100;i++){try{await fetch(base+'/api/atlas/identity');ready=true;break;}catch{await sleep(100);}}assert.ok(ready);
  requests.length=0;const start=Date.now();await send('Page.navigate',{url:base});await until('!!document.querySelector("[aria-label=目前圖鑑]")');
  if(!blank)await until('document.querySelectorAll(".atlas-elf-row").length>0');
  const uiMs=Date.now()-start;await sleep(700);
  assert.equal(requests.filter(u=>/\/seer\/|\/elf-art\/|\/atlas-images\//.test(u)).length,0,'進入不可預載圖片');
  assert.equal(requests.filter(u=>/\/catalog\/(?!(?:index|version)\.json)[^/]+\.json/.test(u)).length,0,'未點選不可載入個別資料');
  if(blank){assert.equal((await fetch(base+'/catalog/index.json')).status,404);assert.equal(requests.filter(u=>u.includes('/catalog/')).length,0);assert.equal(await evaluate('document.querySelectorAll(".atlas-elf-row").length'),0);}
  else{
   await evaluate('document.querySelector(".atlas-elf-row").click()');await until('!!document.querySelector(".spot-grid")');
   assert.equal(requests.filter(u=>/\/catalog\/(?!(?:index|version)\.json)[^/]+\.json/.test(u)).length,1);
   await until('document.querySelector(".spot-body")?.naturalWidth>0');
   const rows=await(await fetch(base+'/catalog/index.json')).json();
   const first=await(await fetch(base+'/catalog/'+rows[0].id+'.json')).json();
   assert.equal(await evaluate('document.querySelector(".spot-body").getAttribute("src")'),first.path);
  }
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,blank?'blank.png':'selected.png'),Buffer.from(shot.data,'base64'));
  fs.writeFileSync(path.join(out,blank?'blank-loading.json':'standard-loading.json'),JSON.stringify({uiMs,requests},null,2));
  if(!blank){
   await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("新增圖鑑")).click()');
   await until('!!document.querySelector("form.atlas-dialog input")');
   await evaluate('(()=>{const e=document.querySelector("form.atlas-dialog input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"切換測試");e.dispatchEvent(new Event("input",{bubbles:true}));})()');
   await evaluate('document.querySelector("form.atlas-dialog").requestSubmit()');
   await until('document.querySelector("[aria-label=目前圖鑑]").selectedOptions[0].textContent==="切換測試"');
   const startRequests=requests.length;
   await evaluate('(()=>{window.atlasWrites=0;const original=window.fetch;window.fetch=(...args)=>{if(args[1]?.method==="PUT")window.atlasWrites++;return original(...args)};const e=document.querySelector("[aria-label=目前圖鑑]");e.value=e.options[0].value;e.dispatchEvent(new Event("change",{bubbles:true}));})()');
   await until('document.querySelectorAll(".atlas-elf-row").length>0');
   assert.equal(await evaluate('window.atlasWrites'),0,'切換圖鑑不等待存檔');
   assert.equal(requests.slice(startRequests).filter(u=>u.includes('/catalog/')||u.includes('/seer/')).length,0,'切換不重新載入已知清單與圖片');
   const updatedIndex=JSON.parse(fs.readFileSync(path.join(catalog,'index.json'),'utf8'));
   const updated=JSON.parse(fs.readFileSync(path.join(catalog,updatedIndex[0].id+'.json'),'utf8'));
   updatedIndex[0].name=updated.name='來源更新驗證精靈';
   fs.writeFileSync(path.join(catalog,updated.id+'.json'),JSON.stringify(updated));
   fs.writeFileSync(path.join(catalog,'index.json'),JSON.stringify(updatedIndex));
   fs.writeFileSync(path.join(catalog,'version.json'),JSON.stringify({fingerprint:'test-updated-source',count:updatedIndex.length}));
   await evaluate('document.dispatchEvent(new Event("visibilitychange"))');
   await until('document.querySelector(".atlas-elf-row")?.textContent.includes("來源更新驗證精靈")');
   await evaluate('document.querySelector(".atlas-elf-row").click()');
   await until('!!document.querySelector(".spot-grid")&&document.querySelector(".atlas-stage").textContent.includes("來源更新驗證精靈")');
   assert.equal(await evaluate('window.atlasWrites'),0,'來源更新不覆寫個人圖鑑');
   console.log('開啟中的圖鑑已取得新版清單與選取介紹，未寫入個人存檔');

  }
  if(blank){
   const content=JSON.parse(fs.readFileSync('encyclopedia/templates/content.example.json','utf8'));
   // Exercise the real file input, including import preview acceptance.
   await evaluate('window.confirm=()=>true');
   const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'.atlas-file-button input'});
   await send('DOM.setFileInputFiles',{nodeId,files:[path.resolve('encyclopedia/templates/content.example.json')]});
   await until('document.querySelectorAll(".atlas-elf-row").length===1');await evaluate('document.querySelector(".atlas-elf-row").click()');await until('!!document.querySelector(".spot-grid")');
   assert.ok((await evaluate('document.body.innerText')).includes(content.elves[0].name));
   const hierarchy=await evaluate('[...document.querySelectorAll("[data-rich-depth]")].map(e=>({depth:Number(e.dataset.richDepth),display:getComputedStyle(e).display,padding:parseFloat(getComputedStyle(e).paddingInlineStart)}))');
   assert.ok(hierarchy.some(r=>r.depth>=2));assert.ok(hierarchy.every(r=>r.display==='block'&&r.padding===r.depth*16));
   const stored=await(await fetch(base+'/api/atlas/library')).json();assert.equal(stored.books.length,2);assert.equal(stored.edition,'blank');assert.deepEqual(stored.books[1].sources,content.sources);
   for(const format of ['png','pdf']){const r=await fetch(base+'/api/atlas/export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bookId:stored.books[1].id,elfId:format==='png'?stored.books[1].custom[0].id:'',format})});assert.equal(r.status,200,await(!r.ok?r.text():Promise.resolve('')));const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length>1000);fs.writeFileSync(path.join(out,'content-export.'+format),bytes);}
  }
  console.log((blank?'空白版':'一般版')+'：介面 '+uiMs+'ms；無圖片預載／點選載入通過');
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
}finally{ws?.close();closePetTestBrowser(proc,profile);for(const s of servers)s.kill();}
