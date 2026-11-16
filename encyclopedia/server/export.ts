import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';

export function findAtlasBrowser(){
 const roots=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean) as string[];
 const candidates=roots.flatMap(root=>[path.join(root,'Microsoft/Edge/Application/msedge.exe'),path.join(root,'Google/Chrome/Application/chrome.exe')]);
 return candidates.find(p=>fs.existsSync(p));
}
export async function renderAtlasExport(base:string,bookId:string,elfId:string,format:'png'|'pdf'){
 const browser=findAtlasBrowser();if(!browser)throw Error('匯出需要已安裝的Microsoft Edge或Google Chrome');
 const listener=net.createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const port=(listener.address() as net.AddressInfo).port;await new Promise<void>(r=>listener.close(()=>r()));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'seer-atlas-export-'));
 const child=spawn(browser,['--headless=new','--edge-skip-compat-layer-relaunch','--no-first-run','--no-default-browser-check','--disable-extensions',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws:WebSocket|undefined;const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
 const deadline=setTimeout(()=>child.kill(),110000);
 try{
  let target:any;
  for(let i=0;i<100;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(100);}}
  if(!target?.webSocketDebuggerUrl)throw Error('無法啟動匯出視窗，請稍後重試');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise<void>((r,j)=>{ws!.addEventListener('open',()=>r(),{once:true});ws!.addEventListener('error',j,{once:true});});
  let serial=0;const pending=new Map<number,{resolve:Function;reject:Function}>();
  ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
  const send=(method:string,params:object={}):Promise<any>=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('匯出等候逾時：'+method));},35000);pending.set(id,{resolve:(value:unknown)=>{clearTimeout(timer);resolve(value);},reject:(e:Error)=>{clearTimeout(timer);reject(e);}});ws!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  const url=new URL(base);url.search=new URLSearchParams({export:'1',book:bookId,...(elfId?{elf:elfId}:{})}).toString();
  await send('Page.navigate',{url:url.href});
  let ready=false;
  for(let i=0;i<300;i++){if(await evaluate('!!document.querySelector("[data-export-ready=true]") && document.querySelectorAll(".spot-grid").length===document.querySelectorAll(".atlas-export-elf").length && document.querySelectorAll(".spot-grid").length>0').catch(()=>false)){ready=true;break;}await sleep(100);}
  if(!ready)throw Error('精靈資料未能載入，沒有產生不完整檔案');
  await evaluate(`Promise.all([document.fonts.ready,...[...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});setTimeout(r,15000)}))])`);
  await sleep(300);
  if(format==='png'){
   const rect=await evaluate('(()=>{const r=document.querySelector(".atlas-export").getBoundingClientRect();return {x:0,y:0,width:Math.ceil(r.width),height:Math.ceil(r.height)}})()');
   if(rect.height>16000)throw Error('這份精靈介紹過長，請改用PDF保存完整內容');
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...rect,scale:1.5}});
   return Buffer.from(shot.data,'base64');
  }
  await send('Emulation.setEmulatedMedia',{media:'print'});
  await evaluate(`(()=>{let css='';document.querySelectorAll('.atlas-export-elf').forEach((node,i)=>{const name='elf'+i;node.style.page=name;css+='@page '+name+'{size:1440px '+Math.min(19000,Math.ceil(node.getBoundingClientRect().height)+4)+'px;margin:0}';});const style=document.createElement('style');style.textContent=css;document.head.append(style)})()`);
  const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0});
  return Buffer.from(pdf.data,'base64');
 }finally{
  clearTimeout(deadline);ws?.close();
  if(child.exitCode===null){child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(2000)]);}
  // 僅清理本次建立且已核對位於Temp下的隔離設定檔，不碰使用者瀏覽器。
  if(path.dirname(profile)===path.resolve(os.tmpdir())&&path.basename(profile).startsWith('seer-atlas-export-'))try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});}catch{}
 }
}
