import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const out=path.resolve('.seer-cache/new-ten-animation-shots');fs.mkdirSync(out,{recursive:true});
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
 const cases=process.env.TEN_ART_CASES?.split(',')||['5037','5038','5039','5040','5042','5043','5044','5045','5046','5047','5043:gaia-godslayer'];
 for(const width of (process.env.TEN_ART_QUICK? [1280]:[1280,1920])){
 await send('Emulation.setDeviceMetricsOverride',{width,height:width===1280?900:1010,deviceScaleFactor:1,mobile:false});
 for(const value of cases){const [owner,skin='']=value.split(':');
 await send('Page.navigate',{url:`${process.env.TEN_ART_BASE||"http://127.0.0.1:3026"}/tests/fixtures/petBattlePreview.html?elf=${owner}&opponent=${owner}&p1Skin=${skin}&p2Skin=${skin}&tools=0`});
 await until('window.petBattle && document.querySelectorAll(\'[data-pet-ready="true"]\').length===2');
 if(skin==='gaia-godslayer')assert.ok(await evaluate(`Array.from(document.querySelectorAll('[data-sprite-ratio]')).every(e=>Number(e.dataset.spriteRatio)===1.65)`),'滅戰神決須真正套用大型構圖');
 await evaluate(`window.actionHistory=[];window.animationObserver=new MutationObserver(()=>{for(const e of document.querySelectorAll('[data-pet-sequence]')){const side=e.closest('[data-sprite-side]')?.getAttribute('data-sprite-side');const sequence=e.getAttribute('data-pet-sequence');const key=side+':'+sequence;if(window.actionHistory.at(-1)!==key)window.actionHistory.push(key);}});window.animationObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-pet-sequence']});`);
 await evaluate(`window.contactEvidence=[];window.expectedHit=${skin?122:attackHits[owner]};window.impactEvidence=[];window.seenPopups=new Set();function sampleImpact(){for(const actor of document.querySelectorAll('[data-pet-sequence="attack"]')){const side=actor.closest('[data-sprite-side]')?.getAttribute('data-sprite-side');if(Number(actor.dataset.petFrame)===window.expectedHit&&!window.contactEvidence.some(e=>e.side===side))window.contactEvidence.push({side,frame:Number(actor.dataset.petFrame),gap:Number(actor.dataset.petContactGap)});}for(const popup of document.querySelectorAll('[data-battle-popup="skill"]')){const id=popup.getAttribute('data-presentation-id');if(window.seenPopups.has(id))continue;window.seenPopups.add(id);const receiver=popup.closest('[data-sprite-side]')?.getAttribute('data-sprite-side');const actor=document.querySelector('[data-sprite-side="'+(receiver==='p1'?'p2':'p1')+'"] [data-pet-sequence]');if(actor)window.impactEvidence.push({receiver,sequence:actor.dataset.petSequence,frame:Number(actor.dataset.petFrame),marker:actor.dataset.petMarker,x:Number(actor.dataset.petBodyX),contact:Number(actor.dataset.petContact),target:Number(actor.dataset.petTarget),front:Number(actor.dataset.petBodyFront),gap:Number(actor.dataset.petContactGap),height:Number(actor.dataset.petBodyHeight)});}requestAnimationFrame(sampleImpact);}sampleImpact();`);
 if(skin==='gaia-godslayer'){await evaluate(`document.querySelector('[data-log-toggle][data-active="true"]')?.click()`);await sleep(400);}
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${width}-${value.replace(':','-')}-standby.png`),Buffer.from(shot.data,'base64'));
 if(!process.env.TEN_ART_QUICK)for(let i=0;i<3;i++){
 await until(`!window.petBattle.isPresenting() && window.petBattle.getState().phase==='p1_select'`);
 await evaluate(`window.petBattle.onSkillSelect('p1',window.petBattle.getState().p1.skills[${i}])`);
 await until(`!window.petBattle.isPresenting() && window.petBattle.getState().phase==='p2_select'`);
 await evaluate(`window.petBattle.onSkillSelect('p2',window.petBattle.getState().p2.skills[${i}])`);
 await until(`window.petBattle.getState().turnNumber>=${i+2} && !window.petBattle.isPresenting()`);
 }
 const evidence=await evaluate(`({owner:${JSON.stringify(owner)},skin:${JSON.stringify(skin)},width:${width},contacts:window.contactEvidence,history:window.actionHistory,impacts:window.impactEvidence,diagnostics:window.petVisualAudit?.diagnostics(),state:{p1:window.petBattle.getState().p1.currentHp,p2:window.petBattle.getState().p2.currentHp}})`);
 if(!process.env.TEN_ART_QUICK){assert.equal(evidence.impacts.length,4,JSON.stringify(evidence));assert.equal(evidence.contacts.length,2,JSON.stringify(evidence));for(const c of evidence.contacts)assert.ok(c.gap>=-14.2&&c.gap<20,JSON.stringify(c));for(const side of ['p1','p2'])for(const action of ['attack','sa','cp','hited'])assert.ok(evidence.history.includes(side+':'+action),side+action);for(const hit of evidence.impacts){assert.ok(hit.marker?.startsWith(hit.sequence+':action_hit:')&&hit.height>0);}assert.ok(evidence.state.p1<10000&&evidence.state.p2<10000);}
 if(skin==='gaia-godslayer'&&process.env.TEN_ART_CASES){await evaluate("window.petVisualAudit.mode('static')");await until("document.querySelectorAll('[data-pet-ready=\"true\"]').length===0");await sleep(500);const staticShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${width}-gaia-godslayer-static.png`),Buffer.from(staticShot.data,'base64'));}
 rows.push(evidence);fs.writeFileSync(path.join(out,process.env.TEN_ART_QUICK?'standby-evidence.json':process.env.TEN_ART_CASES?'skin-battle-evidence.json':'battle-evidence.json'),JSON.stringify(rows,null,2));console.log('✓',width,value);
 }
 }
fs.writeFileSync(path.join(out,'runtime-errors.json'),JSON.stringify(errors,null,2));assert.equal(errors.length,0,JSON.stringify(errors));
}finally{ws?.close();closePetTestBrowser(proc,profile);}
process.exit(0);
