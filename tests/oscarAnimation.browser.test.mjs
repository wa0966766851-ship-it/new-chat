import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const browser=findPetTestBrowser();assert.ok(browser,'驗收需要Edge/Chrome');
const out=path.resolve('.seer-cache/oscar-animation');fs.mkdirSync(out,{recursive:true});
const profile=petTestProfile(),proc=launchPetTestBrowser(browser,port,profile),errors=[],records=[];let ws;
try{
 let target;for(let i=0;i<100;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(100);}}
 assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let serial=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>reject(Error('CDP timeout '+method)),30000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));};
 const until=async(expression,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await evaluate(expression).catch(()=>false))return;await sleep(100);}await shot('timeout');throw Error('timeout '+expression+' '+JSON.stringify(await evaluate('({text:document.body.innerText.slice(-800),diag:window.petVisualAudit?.diagnostics()})')));};
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1010,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:(process.env.OSCAR_TEST_URL||'http://127.0.0.1:3027')+'/tests/fixtures/petBattlePreview.html?elf=5048&opponent=5048&tools=0'});
 await send('Page.bringToFront');
 for(const [skin,source,hits] of [['','oscarGenesis',{attack:100,sa:77}],['oscar-original','oscarOriginal',{attack:114,sa:99}]]){
  await until('!!window.petVisualAudit');await evaluate(`window.petVisualAudit.select('5048',${JSON.stringify(skin)})`);
  await until(`document.querySelectorAll('[data-pet-ready="true"][data-pet-source="${source}"]').length===2 && !!window.petBattle`);
  await evaluate('document.querySelector("[data-log-toggle][data-active=true]")?.click()');
  await sleep(500);await shot(source+'-standby');
  const before=await evaluate('({state:window.petBattle.getState().phase,diagnostics:window.petVisualAudit.diagnostics(),players:[...document.querySelectorAll("[data-pet-ready=true]")].map(e=>({source:e.dataset.petSource,side:e.closest("[data-sprite-side]").dataset.spriteSide,frame:e.dataset.petFrame,loadMs:e.dataset.petLoadMs}))})');
  if(process.argv.includes('--inspect')){records.push({source,before});continue;}
  await evaluate(`window.oscarPerf=[];clearInterval(window.oscarTimer);window.oscarTimer=setInterval(()=>window.oscarPerf.push({at:performance.now(),hidden:document.hidden,players:[...document.querySelectorAll('[data-pet-ready=true]')].map(e=>({source:e.dataset.petSource,action:e.dataset.petAction,sequence:e.dataset.petSequence,frame:e.dataset.petFrame,rate:e.dataset.petDrawRate,maxMs:e.dataset.petRenderMaxMs}))}),300);window.oscarHistory=[];window.oscarImpacts=[];window.oscarSeen=new Set();window.oscarObserver?.disconnect();window.oscarObserver=new MutationObserver(()=>{for(const e of document.querySelectorAll('[data-pet-sequence]')){const row=e.closest('[data-sprite-side]')?.dataset.spriteSide+':'+e.dataset.petSequence;if(window.oscarHistory.at(-1)!==row)window.oscarHistory.push(row)}});window.oscarObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-pet-sequence']});window.oscarRAF&&cancelAnimationFrame(window.oscarRAF);function sample(){for(const popup of document.querySelectorAll('[data-battle-popup="skill"]')){const id=popup.dataset.presentationId;if(window.oscarSeen.has(id))continue;window.oscarSeen.add(id);const receiver=popup.closest('[data-sprite-side]')?.dataset.spriteSide,actor=document.querySelector('[data-sprite-side="'+(receiver==='p1'?'p2':'p1')+'"] [data-pet-sequence]');if(actor)window.oscarImpacts.push({receiver,sequence:actor.dataset.petSequence,frame:Number(actor.dataset.petFrame),marker:actor.dataset.petMarker,contactGap:Number(actor.dataset.petContactGap),height:Number(actor.dataset.petBodyHeight)})}window.oscarRAF=requestAnimationFrame(sample)}sample();`);
  for(let i=0;i<3;i++){
   await until('!window.petBattle.isPresenting() && window.petBattle.getState().phase==="p1_select"');
   await evaluate(`window.petBattle.onSkillSelect('p1',window.petBattle.getState().p1.skills[${i}])`);await until('window.petBattle.getState().phase==="p2_select"');
   await evaluate(`window.petBattle.onSkillSelect('p2',window.petBattle.getState().p2.skills[${i}])`);
   await until(`window.petBattle.getState().turnNumber>=${i+2} && !window.petBattle.isPresenting()`);
  }
  const record=await evaluate('({perf:window.oscarPerf,history:window.oscarHistory,impacts:window.oscarImpacts,diagnostics:window.petVisualAudit.diagnostics(),hp:[window.petBattle.getState().p1.currentHp,window.petBattle.getState().p2.currentHp]})');
  records.push({source,before,...record});fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({records,errors},null,2));
  assert.equal(record.impacts.length,4,'兩側物攻／特攻各一筆，屬性不補傷害');
  for(const row of record.impacts){assert.ok(row.frame>=hits[row.sequence]&&row.frame<=hits[row.sequence]+10,JSON.stringify(row));assert.ok(row.marker?.startsWith(row.sequence+':action_hit:'),JSON.stringify(row));assert.ok(row.height>0);}
  for(const side of ['p1','p2'])for(const action of ['attack','sa','cp','hited'])assert.ok(record.history.includes(side+':'+action),side+':'+action);
  assert.ok(record.hp.every(hp=>hp<10000));assert.equal(record.diagnostics.degraded.length,0);await shot(source+'-after-actions');console.log(source+' 雙側三類技能／命中幀／受擊／收招通過');
 }
 if(!process.argv.includes('--inspect')){
  await evaluate("window.petVisualAudit.select('5048','oscar-genesis')");await until('document.querySelectorAll("[data-pet-source=oscarGenesis][data-pet-ready=true]").length===2');
  await evaluate("window.petVisualAudit.mode('static')");await until('document.querySelectorAll("[data-pet-ready=true]").length===0');await sleep(400);
  const final=await evaluate('window.petVisualAudit.diagnostics()');assert.ok(final.leases.every(l=>l.users===0));
  await evaluate("window.petVisualAudit.mode('actions')");await until('document.querySelectorAll("[data-pet-ready=true]").length===2');
  await send('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});await sleep(400);await shot('narrow-genesis');
 }
 fs.writeFileSync(path.join(out,process.argv.includes('--inspect')?'inspection.json':'evidence.json'),JSON.stringify({records,errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));
}finally{ws?.close();closePetTestBrowser(proc,profile);}
