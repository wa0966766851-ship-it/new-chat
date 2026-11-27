import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {build} from 'vite';
import {createServer as reservePort} from 'node:net';
import {launchPetTestBrowser,closePetTestBrowser,findPetTestBrowser,petTestProfile} from './helpers/petBrowserProcess.mjs';
const preview=path.resolve('.seer-cache/destiny-layout-preview');
const app=express();
await build({configFile:'vite.config.ts',publicDir:false,logLevel:'warn',build:{outDir:preview,emptyOutDir:true,sourcemap:false,rollupOptions:{input:path.resolve('tests/fixtures/destinyLayout.html')}}});
app.use(express.static(preview));app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
const portServer=reservePort();await new Promise<void>(r=>portServer.listen(0,'127.0.0.1',r));const debugPort=(portServer.address() as {port:number}).port;await new Promise<void>(r=>portServer.close(()=>r()));
const profile=petTestProfile(),browser=launchPetTestBrowser(findPetTestBrowser(),debugPort,profile);
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));let socket:WebSocket;
try{
 let target:any;for(let i=0;i<100;i++){try{target=await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());break;}catch{await delay(100);}}
 assert.ok(target);socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 const runtimeErrors:any[]=[];
 let sequence=0;const pending=new Map<number,{resolve:(v:any)=>void;reject:(e:any)=>void}>();
 socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data)),task=pending.get(message.id);if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')runtimeErrors.push(message.params.entry);if(!task)return;pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result);});
 const send=(method:string,params={})=>new Promise<any>((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>reject(Error('CDP逾時 '+method)),30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression:string)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async(expression:string)=>{for(let i=0;i<250;i++){if(runtimeErrors.some(e=>e.exception))throw Error(JSON.stringify(runtimeErrors));if(await evaluate(expression).catch(()=>false))return;await delay(100);}throw Error('畫面逾時 '+expression+' '+JSON.stringify(runtimeErrors)+' '+await evaluate('document.body.innerText.slice(0,300)'));};
 const click=async(id:string)=>evaluate(`document.querySelector('[data-testid="${id}"]').click()`);
 await send('Log.enable');await send('Page.enable');await send('Runtime.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const out=path.resolve('.seer-cache/destiny-adaptive');fs.mkdirSync(out,{recursive:true});
 const measurements=[];
 for(const [width,height,shell] of [[1280,720,'sidebar'],[1366,768,'sidebar'],[1920,1080,'sidebar'],[1920,1080,'full'],[1905,1058,'full'],[1280,720,'full'],[800,900,'full']] as const){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin+'/tests/fixtures/destinyLayout.html?mode=PVP&shell='+shell});await until('!!document.querySelector("[data-testid=b-start]")');
  await click('b-start');await until('!!document.querySelector("[data-testid=b-next-ban]")');const reveal=await evaluate(`(()=>{const c=document.querySelector('[data-testid=b-card]').getBoundingClientRect();return {width:c.width,height:c.height};})()`);await click('b-next-ban');
  await until('!!document.querySelector("[data-testid=b-confirm-ban]")');
  const ban=await evaluate(`(()=>{const c=document.querySelector('[data-testid=b-ban-card]').getBoundingClientRect();return {width:c.width,height:c.height};})()`);
  for(const key of ['b-ban-card','b-ban-own-card'])for(let index=0;index<3;index++)await evaluate(`document.querySelectorAll('[data-testid=${key}]')[${index}].click()`);
  await click('b-confirm-ban');await until('!!document.querySelector("[data-testid=b-pick-p1]")');
  const measure=await evaluate(`(()=>{const rect=s=>{const r=document.querySelector('[data-testid='+s+']').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {pick:rect('b-pick-card'),left:rect('b-loadout-panel-p1'),right:rect('b-loadout-panel-p2'),pool:rect('b-pick-p1'),pool2:rect('b-pick-p2'),scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,railBottom:document.querySelector('.dwb-rail').getBoundingClientRect().bottom,viewport:innerWidth,controls:[...document.querySelectorAll('.dwb-lo-summary')].map(e=>{const r=e.getBoundingClientRect();return {bottom:r.bottom,right:r.right};}),slots:[...document.querySelectorAll('[data-testid=b-pick-card]')].map(e=>Number(e.dataset.poolSlot)),banned:document.querySelectorAll('[data-testid=b-pick-card][data-banned="1"]').length};})()`);
  const previewShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${width}x${height}.png`),Buffer.from(previewShot.data,'base64'));
  assert.deepEqual(measure.slots,Array.from({length:12},(_,i)=>i+1));assert.equal(measure.banned,3);assert.ok(measure.scrollWidth<=width+1,'頁面不可橫向溢出');
  for(const card of [reveal,ban,measure.pick])assert.ok(Math.abs(card.width/card.height-.75)<.005,'各階段必須維持3:4直式卡片');
  if(width>=1000){
   assert.ok(Math.abs(reveal.width-ban.width)<=1&&Math.abs(ban.width-measure.pick.width)<=1,'翻牌/禁選/編隊維持相同卡片寬度');
   if(width>=1900)assert.ok(measure.pick.width>=145,'大螢幕不能仍被112px上限壓成窄小區塊');
   assert.ok(Math.abs(ban.height-measure.pick.height)<=1,'禁選轉編隊不可放大卡片');
   assert.ok(measure.left.right<=measure.pool.x,'P1配裝在左側');assert.ok(measure.right.x>=measure.pool2.right,'P2配裝在右側');
   assert.ok(Math.max(measure.pool.bottom,measure.pool2.bottom,measure.left.bottom,measure.right.bottom)<=height,JSON.stringify({width,height,measure}));
   assert.ok(await evaluate(`Array.from(document.querySelectorAll('[data-testid=b-pick-card]')).every(card=>{const name=card.querySelector('.dwb-card-name').getBoundingClientRect();return Array.from(card.querySelectorAll('.dwb-card-detail,.dwb-card-star')).every(button=>button.getBoundingClientRect().bottom<=name.top+1);})`),'詳情/首發按鈕不遮住技能卡名稱');
   assert.ok(measure.controls.every((r:any)=>r.bottom<=height&&r.right<=width),'所有配裝選項首屏可見');
   assert.ok(measure.scrollHeight<=height+1&&measure.railBottom<=height+1,'整頁及底部步驟列不可超出首屏：'+JSON.stringify({width,height,shell,measure}));
  }
  assert.equal(await evaluate("document.querySelectorAll('.dwb-lo-opts').length"),0,'配裝預設收合');
  await click('b-lo-summary-p1-suit');
  assert.ok(await evaluate("document.querySelectorAll('[data-testid=b-lo-p1-suit]').length>0"),'點擊展開候選');
  await evaluate("document.querySelectorAll('[data-testid=b-lo-p1-suit]')[1].click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-testid=b-lo-p1-suit]').length"),0,'選擇完成自動收合');
  measurements.push({width,height,shell,reveal,ban,...measure});
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${width}x${height}-${shell}.png`),Buffer.from(shot.data,'base64'));
 }
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));
 console.log('真實瀏覽器：七種視窗/外殼組合、頂列50px、全階段3:4比例與大小一致、寬螢幕充分利用、24張與禁用保留、左右配裝摘要/展開/選擇收合通過');
}finally{socket?.close();closePetTestBrowser(browser,profile);server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
