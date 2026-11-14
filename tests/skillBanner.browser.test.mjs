import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const out=path.resolve('shots/skill-banner');fs.mkdirSync(out,{recursive:true});
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


 for(const [width,height] of [[1920,1080],[1280,900],[1024,768],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  if(!rows.length)await send('Page.navigate',{url:'http://127.0.0.1:3026/tests/fixtures/petBattlePreview.html?elf=70&opponent=70&tools=1'});
  else {await evaluate('window.petVisualAudit.select("70","")');await sleep(250);}
  await until(`window.petVisualAudit && window.petBattle && document.querySelectorAll('[data-pet-ready="true"]').length===2`);
  await evaluate(`window.bannerSamples=[];window.bannerTimer=setInterval(()=>{for(const e of document.querySelectorAll('[data-battle-skill-banner]')){const r=e.getBoundingClientRect(),buttons=[...document.querySelectorAll('.btg-skill,button[data-skill-disabled]')].map(b=>b.getBoundingClientRect()).filter(b=>b.width&&b.height);if(!buttons.length)continue;window.bannerSamples.push({side:e.dataset.battleSkillBanner,top:r.top,bottom:r.bottom,left:r.left,right:r.right,panelTop:Math.min(...buttons.map(b=>b.top)),type:e.querySelector('.btg-typeslot')?.title,text:e.innerText});}},30);document.querySelector('[data-preview-action="attack"]').click()`);
  await until('window.bannerSamples?.some(s=>s.side==="p1"&&s.type==="電系") && window.bannerSamples?.some(s=>s.side==="p2"&&s.type==="屬性技能")');
  const samples=await evaluate('clearInterval(window.bannerTimer);window.bannerSamples');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${width}x${height}.png`),Buffer.from(screenshot.data,'base64'));
  for(const row of samples){assert.ok(row.bottom<=row.panelTop-8,JSON.stringify({width,height,...row}));assert.ok(row.top>=0,JSON.stringify(row));}
  rows.push({width,height,samples});console.log('✓ banner',width,height,'samples',samples.length,'minGap',Math.min(...samples.map(r=>r.panelTop-r.bottom)));
 }
 assert.equal(errors.length,0,JSON.stringify(errors));fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify({rows,errors},null,2));
}finally{ws?.close();closePetTestBrowser(proc,profile);}
