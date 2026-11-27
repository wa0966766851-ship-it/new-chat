import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {launchPetTestBrowser,closePetTestBrowser,findPetTestBrowser,petTestProfile} from './helpers/petBrowserProcess.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const selected=process.argv[2];
const active=selected?undefined:JSON.parse(fs.readFileSync('.desktop-releases/active.json','utf8'));
const dir=path.resolve(selected||path.join('.desktop-releases',active.id));
const version=JSON.parse(fs.readFileSync(path.join(dir,'version.json'),'utf8'));
const port=await freePort(),debug=await freePort();
const data=path.resolve('.seer-cache','desktop-boot-'+Date.now());fs.mkdirSync(data,{recursive:true});
const server=spawn(process.execPath,[path.join(dir,'server.cjs')],{stdio:'ignore',windowsHide:true,env:{...process.env,NODE_ENV:'production',PORT:String(port),SEER_HOST:'127.0.0.1',SEER_DIST_DIR:dir,SEER_RELEASE_ID:version.buildId,SEER_PLAYER_DATA_DIR:data}});
let browser,profile,socket;
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/launcher/identity`);if(r.ok&&(await r.json()).buildId===version.buildId){ready=true;break;}}catch{}await pause(100);}assert.ok(ready,'正式後端未就緒');
 const executable=findPetTestBrowser();assert.ok(executable,'無法找到瀏覽器，不能驗證桌面畫面');
 profile=petTestProfile();browser=launchPetTestBrowser(executable,debug,profile);
 let target;for(let i=0;i<100;i++){try{target=await fetch(`http://127.0.0.1:${debug}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());break;}catch{}await pause(100);}assert.ok(target,'驗證瀏覽器未就緒');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('瀏覽器連線逾時')),10000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});});
 let seq=0;const requests=new Map(),errors=[];
 socket.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.method==='Page.javascriptDialogOpening')socket.send(JSON.stringify({id:++seq,method:'Page.handleJavaScriptDialog',params:{accept:true}}));if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(requests.has(m.id)){requests.get(m.id)(m);requests.delete(m.id);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>reject(Error('瀏覽器操作逾時：'+method)),10000);requests.set(id,m=>{clearTimeout(timer);m.error?reject(Error(m.error.message)):resolve(m.result);});socket.send(JSON.stringify({id,method,params}));});
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`http://127.0.0.1:${port}`});
 let rendered=false;for(let i=0;i<120;i++){assert.deepEqual(errors,[],'正式遊戲畫面啟動錯誤');const r=await send('Runtime.evaluate',{expression:'document.body.innerText.length>150 && !!document.querySelector("#root button")',returnByValue:true});if(r.result?.value){rendered=true;break;}await pause(250);}
 assert.ok(rendered,'正式遊戲首頁未呈現');await pause(2000);assert.deepEqual(errors,[],'首頁啟動後出現錯誤');
 console.log('桌面正式首頁瀏覽器啟動通過：'+version.buildId);
 if(process.argv.includes('--training')){
  const {verifyNativeTraining}=await import('./helpers/nativeTrainingBrowser.mjs');
  await verifyNativeTraining(send,`http://127.0.0.1:${port}`);
  assert.deepEqual(errors,[],'新版培養操作出現執行錯誤');
 }
}finally{socket?.close();if(browser)closePetTestBrowser(browser,profile);server.kill();}
