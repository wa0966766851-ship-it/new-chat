import {findPetTestBrowser,petTestProfile,launchPetTestBrowser,closePetTestBrowser} from './helpers/petBrowserProcess.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=findPetTestBrowser();assert.ok(browser,'需要 Chromium 瀏覽器驗收，不能跳過當通過');
const port=9891,profile=petTestProfile(),proc=launchPetTestBrowser(browser,port,profile);
const out=path.resolve('docs/audits/custom-animation-20261104');fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let ws;
const results=[];const action=process.env.CUSTOM_FX_ACTION||'sa',unknown=process.env.CUSTOM_FX_UNKNOWN==='1';const readyExpression=unknown?'document.querySelectorAll("[data-unknown-elf-action]").length===2':'document.querySelectorAll("[data-pet-ready=true]").length===2';
try{
 let target;
 for(let i=0;i<80;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await pause(200);}}
 assert.ok(target,'測試瀏覽器未就緒');ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map();
 const receive=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.consoleAPICalled'&&['warning','error'].includes(m.params.type))console.log(m.params.args.map(a=>a.value||a.description).join(' '));if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(m.error):p.resolve(m.result);}}};
 ws.addEventListener('message',receive);
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},15000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async(expression,timeout=60000)=>{const end=Date.now()+timeout;while(Date.now()<end){const v=await evaluate(expression);if(v)return v;await pause(40);}console.log(await evaluate('JSON.stringify({trace:window.fxTrace,text:document.body.innerText.slice(0,2500)})'));throw Error('等待失敗 '+expression);};
 let used=false;
 for(const asset of (process.env.CUSTOM_FX_ASSETS||'wuxu_zhuixing,wuxu_shiyan,emperor_dixin,wuxu_liuren').split(',')){
  const spec=JSON.parse(fs.readFileSync('public/elf-anim/'+asset+'/manifest.json','utf8'));
  for(const side of ['p1','p2']){
   // 虛擬時鐘只為定格截圖；每個案例使用新分頁，避免把加速時鐘帶進下一案例。
   if(used){ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});ws.addEventListener('message',receive);}used=true;
   await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
   const base=process.env.PET_PREVIEW_ORIGIN||'http://127.0.0.1:3015';
   await send('Page.navigate',{url:`${base}/tests/fixtures/petBattlePreview.html?elf=${spec.elfId}&opponent=${spec.elfId}&tools=1${unknown?'&unknown=1':''}`});
   try{await until(readyExpression);}catch(e){
    console.log(await evaluate('JSON.stringify({diagnostics:window.petVisualAudit?.diagnostics(),text:document.body.innerText.slice(-3500)})'));
    const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:82,fromSurface:false,captureBeyondViewport:false});fs.writeFileSync(path.join(out,asset+'-failed.jpg'),Buffer.from(shot.data,'base64'));throw e;
   }
   if(unknown){
    assert.equal(await evaluate('window.petVisualAudit.diagnostics().leases.length'),0,'隱匿時不下載真實動作圖集');
    await until(`Array.from(document.querySelectorAll('[data-sprite-side] img')).filter(i=>i.src.includes('unknown_myth_ghost_body')).length===2`);
   }
   if(side==='p2'){
    await evaluate(`(()=>{const s=document.querySelector('[aria-label="出招方"]');s.value='p2';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    await pause(1200);await until(readyExpression);
   }
   await until(`!document.querySelector('[data-preview-action="${action}"]').disabled`);
   await evaluate(`(()=>{window.fxTrace=[];let last='';const obs=new MutationObserver(()=>{const s=Array.from(document.querySelectorAll('[data-custom-battle-fx],[data-pet-sequence]')).map(e=>e.dataset.customBattleFx+':'+e.dataset.sequence+':'+e.dataset.phase+':'+e.dataset.petSequence).join('|');if(s!==last){last=s;window.fxTrace.push(s);}});obs.observe(document.body,{attributes:true,subtree:true});})()`);
   await evaluate(`document.querySelector('.pet-workbench-toggle').click()`);
   await evaluate(`document.querySelector('[data-preview-action="${action}"]').click()`);
   const wantedPhase=action==='extra'&&!unknown?"c?.dataset.phase==='buff'&&c.dataset.sequence==='extra'&&Number(c.dataset.impact)>.18":"c?.dataset.phase==='impact'&&Number(c.dataset.impact)>.18";
   const actualAction=unknown?`document.querySelector('[data-unknown-elf-action="${side}"]')?.dataset.unknownSequence==='${action}'`:'true';
   const impactExpression=`(()=>{const c=document.querySelector('[data-custom-battle-fx="${side}"]');return (${actualAction})&&(${wantedPhase})?{from:c.dataset.from,to:c.dataset.to,phase:c.dataset.phase,width:c.width,height:c.height}:null})()`;
   const evidence=await until(impactExpression,45000);
   const layer=await evaluate(`document.querySelector('[data-custom-battle-fx="${side}"]').toDataURL('image/png')`);
   fs.writeFileSync(path.join(out,asset+'-'+side+'-'+action+(unknown?'-unknown':'')+'-fx.png'),Buffer.from(layer.split(',')[1],'base64'));
   
   const from=evidence.from.split(',').map(Number),to=evidence.to.split(',').map(Number);
   assert.ok(side==='p1'?to[0]>from[0]:to[0]<from[0],asset+' 特效方向錯誤 '+side);
   await until('window.petBattle?.getState().phase==="p1_select"&&!window.petBattle?.isPresenting?.()',45000);
   assert.deepEqual(await evaluate('window.petVisualAudit.diagnostics().degraded'),[],'完整正常時鐘收招不得降級');
   // 命中時直接保存特效層；整場截圖在收招後拍攝，不凍結時鐘，也不把空白視窗當命中證據。
   const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:82,captureBeyondViewport:false});
   fs.writeFileSync(path.join(out,asset+'-'+side+'-'+action+(unknown?'-unknown':'')+'-end.jpg'),Buffer.from(shot.data,'base64'));
   results.push({asset,side,action,unknown,...evidence});fs.writeFileSync(path.join(out,`results-${action}${unknown?'-unknown':''}.json`),JSON.stringify(results,null,2));console.log(asset+' '+side+' 正式對戰出招、命中與收招通過');
  }
 }
 fs.writeFileSync(path.join(out,`results-${action}${unknown?'-unknown':''}.json`),JSON.stringify({origin:process.env.PET_PREVIEW_ORIGIN||'http://127.0.0.1:3015',viewport:[1366,768],results},null,2));
}finally{ws?.close();closePetTestBrowser(proc,profile);}
