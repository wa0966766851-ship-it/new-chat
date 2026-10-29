import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
/**
 * 精靈動作的依賴區塊（dist/assets/vendor-pet-*、解析 Worker）真的能在瀏覽器載入並求值。
 * 不需要動作素材：只驗模組載入順序（循環引入、Buffer 全域）。需先 npm run build；沒有 dist 或瀏覽器則跳過。
 * 這類錯誤（Cannot access 'x' before initialization、Buffer is not defined）在 vite build 與 audit 的大小檢查都看不出來。
 */
const dist=path.resolve('dist');
if(!fs.existsSync(path.join(dist,'index.html'))){console.log('跳過：沒有 dist（先 npm run build）');process.exit(0);}
const browser=findPetTestBrowser();
if(!browser){console.log('跳過：找不到 Edge／Chrome／Chromium（可用 PET_TEST_BROWSER 指定）');process.exit(0);}
const assets=fs.readdirSync(path.join(dist,'assets')).filter(f=>f.endsWith('.js'));
const pick=re=>assets.find(f=>re.test(f));
const actions=pick(/^vendor-pet-actions-/),image=pick(/^vendor-pet-image-/),pixi=pick(/^vendor-pet-pixi-/),unity=pick(/^vendor-pet-unity-/);
const worker=assets.filter(f=>/^worker-/.test(f)).sort((a,b)=>fs.statSync(path.join(dist,'assets',b)).size-fs.statSync(path.join(dist,'assets',a)).size)[0];
assert.ok(actions&&image&&pixi&&unity&&worker,'dist 應含精靈動作各區塊與解析 Worker');
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{const url=decodeURIComponent(new URL(req.url,'http://x').pathname);const file=path.join(dist,url==='/'?'index.html':url);
 if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=9600+Math.floor(Math.random()*300),profile=petTestProfile(),proc=launchPetTestBrowser(browser,port,profile);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try{
 let target;for(let i=0;i<80;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(250);}}
 assert.ok(target,'headless browser ready');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});await sleep(2500);
 const result=(await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const out={};
  for(const [name,file] of [['actions',${JSON.stringify(actions)}],['image',${JSON.stringify(image)}],['pixi',${JSON.stringify(pixi)}],['unity',${JSON.stringify(unity)}]]){
   try{await import('/assets/'+file);out[name]='ok';}catch(e){out[name]='ERROR '+e;}}
  out.buffer=typeof Buffer;
  out.worker=await new Promise(res=>{const w=new Worker('/assets/'+${JSON.stringify(worker)},{type:'module'});const t=setTimeout(()=>{w.terminate();res('ok');},3000);w.onerror=e=>{clearTimeout(t);res('ERROR '+(e.message||'')+' '+e.filename+':'+e.lineno);};});
  return out;})()`})).result.value;
 for(const key of ['actions','image','pixi','unity','worker'])assert.equal(result[key],'ok',`${key} 區塊載入：${JSON.stringify(result)}`);
 assert.equal(result.buffer,'function','載入精靈動作區塊後全域 Buffer 應存在');
 console.log('精靈動作各區塊與解析 Worker 可載入、全域 Buffer 就緒');
}finally{ws?.close();closePetTestBrowser(proc,profile);server.close();}
process.exit(0);
