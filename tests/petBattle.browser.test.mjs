import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const port=9600+Math.floor(Math.random()*300);
const browser=findPetTestBrowser();
if(!browser){console.log('跳過：找不到 Edge／Chrome／Chromium（可用 PET_TEST_BROWSER 指定）');process.exit(0);}
const out=path.resolve(process.env.PET_TEST_OUT||'.seer-cache/animation-shots');fs.mkdirSync(out,{recursive:true});
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
 await send('Page.navigate',{url:process.env.PET_TEST_URL||'http://127.0.0.1:3013/tests/fixtures/petBattlePreview.html'});
 const until=async(expression,ms=60000)=>{const end=Date.now()+ms;while(Date.now()<end){const result=await evaluate(expression);if(result)return result;await sleep(100);}throw Error('timeout: '+expression+'\n'+JSON.stringify(logs.slice(-8)));};
 await until(`window.petBattle && document.querySelectorAll('[data-pet-ready="true"]').length===2`);
 assert.ok(await evaluate(`document.querySelector('[data-battle-root]').getBoundingClientRect().height>500`),'驗收場地必須可見');
 await evaluate(`window.actionHistory=[];window.animationObserver=new MutationObserver(()=>{for(const e of document.querySelectorAll('[data-pet-sequence]')){const side=e.closest('[data-sprite-side]')?.getAttribute('data-sprite-side');const sequence=e.getAttribute('data-pet-sequence');const key=side+':'+sequence;if(window.actionHistory.at(-1)!==key)window.actionHistory.push(key);}});window.animationObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-pet-sequence']});`);
 await evaluate(`window.impactEvidence=[];window.seenPopups=new Set();function sampleImpact(){for(const popup of document.querySelectorAll('[data-battle-popup="skill"]')){const id=popup.getAttribute('data-presentation-id');if(window.seenPopups.has(id))continue;window.seenPopups.add(id);const receiver=popup.closest('[data-sprite-side]')?.getAttribute('data-sprite-side');const actor=document.querySelector('[data-sprite-side="'+(receiver==='p1'?'p2':'p1')+'"] [data-pet-sequence]');if(actor)window.impactEvidence.push({receiver,sequence:actor.dataset.petSequence,frame:Number(actor.dataset.petFrame),marker:actor.dataset.petMarker,x:Number(actor.dataset.petBodyX),contact:Number(actor.dataset.petContact),target:Number(actor.dataset.petTarget),height:Number(actor.dataset.petBodyHeight)});}requestAnimationFrame(sampleImpact);}sampleImpact();`);
 for(let i=0;i<3;i++){
  await until(`!window.petBattle.isPresenting() && window.petBattle.getState().phase==='p1_select'`);
  await evaluate(`window.petBattle.onSkillSelect('p1',window.petBattle.getState().p1.skills[${i}])`);
  await until(`window.petBattle.getState().phase==='p2_select'`);
  await evaluate(`window.petBattle.onSkillSelect('p2',window.petBattle.getState().p2.skills[${i}])`);
  await until(`window.petBattle.getState().turnNumber>=${i+2} && !window.petBattle.isPresenting()`);
 }
 const history=await evaluate('window.actionHistory');
 const impacts=await evaluate('window.impactEvidence');
 fs.writeFileSync(path.join(out,'impact-evidence.json'),JSON.stringify(impacts,null,2));
 assert.equal(impacts.length,4,'兩側物理與特殊攻擊各一筆；屬性技能不偽造紅字');
 for(const impact of impacts){assert.ok(['attack','sa'].includes(impact.sequence),JSON.stringify(impact));assert.ok(impact.frame<70,'紅字在收招前顯示');assert.ok(impact.marker?.startsWith(impact.sequence+':action_hit:'),JSON.stringify(impact));assert.ok(impact.height>0&&Number.isFinite(impact.height),'本體依實際場域比例呈現，手機不硬套桌面250px門檻');}
 fs.writeFileSync(path.join(out,'battle-debug.json'),JSON.stringify({history,state:await evaluate(`window.petBattle.getState()`),logs,failures},null,2));
 for(const side of ['p1','p2'])for(const action of ['attack','sa','cp','hited'])assert.ok(history.includes(side+':'+action),side+':'+action+' '+JSON.stringify(history));
 const state=await evaluate(`({p1:window.petBattle.getState().p1.currentHp,p2:window.petBattle.getState().p2.currentHp,turn:window.petBattle.getState().turnNumber,logs:window.petBattle.getState().logs.map(l=>l.text)})`);
 assert.ok(state.p1<10000&&state.p2<10000,'實際引擎必須結算雙側傷害');
 await evaluate(`localStorage.setItem('battleAnimationSettings',JSON.stringify({mode:'static',skill:true}));window.dispatchEvent(new Event('battle-animation-update'));`);
 await until(`document.querySelectorAll('[data-pet-ready="true"]').length===0`);
 await evaluate(`localStorage.setItem('battleAnimationSettings',JSON.stringify({mode:'actions',skill:true}));window.dispatchEvent(new Event('battle-animation-update'));`);
 await until(`document.querySelectorAll('[data-pet-ready="true"]').length===2`);
 await sleep(500);
 const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'rey-real-battle.png'),Buffer.from(shot.data,'base64'));
 fs.writeFileSync(path.join(out,'battle-evidence.json'),JSON.stringify({state,history,logs,failures},null,2));
 const skins=[];
 for(const id of ['7070','707070','5029']){
  const url=new URL(process.env.PET_TEST_URL||'http://127.0.0.1:3013/tests/fixtures/petBattlePreview.html');url.searchParams.set('elf',id);
  // 對手固定用同一隻一般精靈：5029 的魂印會在登場時令自己麻痺，
  // 兩邊都放 5029 會變成雙方都動不了，驗不到出招／受擊的動作切換。
  url.searchParams.set('opponent','5028');
  await send('Page.navigate',{url:url.href});
  await until(`window.petBattle && window.petBattle.getState().p1.id==='${id}' && document.querySelectorAll('[data-pet-ready="true"]').length===2`);
  await evaluate(`window.skinActions=[];new MutationObserver(()=>{for(const e of document.querySelectorAll('[data-pet-sequence]'))window.skinActions.push(e.closest('[data-sprite-side]')?.getAttribute('data-sprite-side')+':'+e.getAttribute('data-pet-sequence'));}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-pet-sequence']});window.petBattle.onSkillSelect('p1',window.petBattle.getState().p1.skills[0]);`);
  await until(`window.petBattle.getState().phase==='p2_select'`);
  await evaluate(`window.petBattle.onSkillSelect('p2',window.petBattle.getState().p2.skills[0])`);
  await until(`window.petBattle.getState().turnNumber===2 && !window.petBattle.isPresenting()`);
  const result=await evaluate(`({id:window.petBattle.getState().p1.id,skinId:window.petBattle.getState().p1.skinId,hp:window.petBattle.getState().p1.currentHp,p2hp:window.petBattle.getState().p2.currentHp,turn:window.petBattle.getState().turnNumber,p1SelfParalyzed:window.petBattle.getState().logs.some(l=>l.text.includes('無法行動')),actions:[...new Set(window.skinActions)]})`);
  assert.equal(result.skinId,'rey-original');
  // 5029 異境神霆·雷伊的魂印會在開場令自身麻痺，自己那一下不一定打得出去；
  // 這裡驗的是「這一回合確實結算過傷害」，所以兩邊任一扣血即可，不必強求自身扣血。
  assert.ok(result.turn>=2,JSON.stringify(result));
  assert.ok(result.hp<10000||result.p2hp<10000,JSON.stringify(result));
  for(const side of ['p1','p2'])for(const action of ['attack','hited'])assert.ok(result.actions.includes(side+':'+action),JSON.stringify(result));
  skins.push(result);
 }
 fs.writeFileSync(path.join(out,'three-rey-skins.json'),JSON.stringify(skins,null,2));
 assert.ok(!logs.some(l=>l.startsWith('ReferenceError')||l.startsWith('TypeError')),JSON.stringify(logs));
 console.log('正式對戰畫面＋引擎：雙側三類出招／受擊、傷害結算、模式切換，以及三隻雷伊指定皮膚實戰通過');
}finally{ws?.close();closePetTestBrowser(proc,profile);}
