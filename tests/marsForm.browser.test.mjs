import assert from 'node:assert/strict';
import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';

const browser=findPetTestBrowser();
assert.ok(browser,'需要 Edge 或 Chrome 驗證真實機甲素材');
const port=9600+Math.floor(Math.random()*300),profile=petTestProfile();
const proc=launchPetTestBrowser(browser,port,profile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
async function poll(read,ms=45000) {
 const deadline=performance.now()+ms;
 do {try {const value=await read();if(value)return value;} catch {} await sleep(100);}while(performance.now()<deadline);
 throw Error('等待瀏覽器狀態逾時');
}
try{
 const target=await poll(async()=>await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json());
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let serial=0;const pending=new Map(),errors=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{
  const output=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(output.exceptionDetails)throw Error(output.exceptionDetails.exception?.description||output.exceptionDetails.text);
  return output.result.value;
 };
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
 for(const side of ['p1','p2']){
  const base=process.env.PET_TEST_URL||'http://127.0.0.1:3016/tests/fixtures/petBattlePreview.html';
  await send('Page.navigate',{url:base+(side==='p1'?'?elf=5016&opponent=70&formCheck':'?elf=70&opponent=5016&formCheck')});
  try {
   await poll(()=>evaluate(`!!window.petBattle && !!document.querySelector('[aria-label="驗收場景"]')`),90000);
   await evaluate(`(() => {const el=document.querySelector('[aria-label="驗收場景"]');el.value='mechanism';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   const read=`(() => {
    const root=document.querySelector('[data-sprite-side="${side}"]');
    const p=[...root?.querySelectorAll('[data-pet-source]')||[]],visible=p.filter(e=>e.dataset.petReady==='true');
    return {turn:window.petBattle?.getState()?.turnNumber,mech:window.petBattle?.getState()?.${side}RegistryState?.mechCombo,
      source:visible[0]?.dataset.petSource,visible:visible.length,ready:p.filter(e=>e.dataset.petPrepared==='true').length,
      visibleHeight:Number(root?.dataset.spriteVisible),rest:visible[0]?.dataset.petRest,busy:window.petBattle?.isPresenting(),
      parked:p.find(e=>e.dataset.petReady==='false')?.dataset.petFrame};
   })()`;
   await poll(async()=>{const s=await evaluate(read);return s.mech==='極速'&&s.ready===2&&!s.busy;},90000);
   const start=await evaluate(read);
   await evaluate(`(() => {
    const root=document.querySelector('[data-sprite-side="${side}"]');
    const canvases=[...root.querySelectorAll('[data-pet-source] canvas')];
    window.formProbe={canvases,blanks:0,frames:0,transform:0,running:true};
    const sample=()=>{
     if(!window.formProbe.running)return;
     const active=root.querySelector('[data-pet-ready="true"]');
     window.formProbe.frames++;
     if(!active||root.querySelector('[data-pet-ready="true"] canvas')===null)window.formProbe.blanks++;
     if(active?.dataset.petSequence==='transform')window.formProbe.transform++;
     requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
   })()`);
   for(const [i,source] of ['marthusDestroy','marthus','marthusDestroy','marthus'].entries()){
    await evaluate(`(() => {const d=window.petBattle,s=d.getState();d.onSkillSelect('p1',s.p1.skills[${side==='p1'?4:2}]);d.onSkillSelect('p2',s.p2.skills[${side==='p2'?4:2}]);})()`);
    await poll(async()=>{const s=await evaluate(read);return s.turn>=start.turn+i+1&&s.source===source&&!s.busy;},20000);
    const s=await evaluate(read);
    assert.equal(s.visible,1);assert.equal(s.ready,2);
    const [, ,bottom,top]=s.rest.split(',').map(Number);
    assert.ok(Math.abs(bottom)<=1&&Math.abs(top-bottom-s.visibleHeight)<=1,`${side} ${source} 待機貼地且等高 ${JSON.stringify(s)}`);
   }
   const parked=(await evaluate(read)).parked;await sleep(250);assert.equal((await evaluate(read)).parked,parked,'背景機甲停止推進影格');
   const result=await evaluate(`(() => {const q=window.formProbe;q.running=false;
    const current=[...document.querySelectorAll('[data-sprite-side="${side}"] [data-pet-source] canvas')];
    return {same:q.canvases.length===2&&current.every(c=>q.canvases.includes(c)),blanks:q.blanks,frames:q.frames,transform:q.transform};})()`);
   assert.ok(result.frames>20&&result.transform>0);assert.equal(result.blanks,0);assert.equal(result.same,true);
   console.log(`✓ ${side} 第五技能四次切換，${result.frames} 幀未跳靜態，雙畫布重用，${result.transform} 幀變身過場`);
  } catch(error) {
   const status=await evaluate(`({battle:window.petBattle?.getState()?.phase,diag:window.petVisualAudit?.diagnostics(),text:document.body.innerText.slice(0,1200)})`);
   throw Error(JSON.stringify({side,status,errors}),{cause:error});
  }
 }
}finally{ws?.close();closePetTestBrowser(proc,profile);}
