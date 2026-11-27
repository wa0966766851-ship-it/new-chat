import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {closePetTestBrowser,findPetTestBrowser,petTestProfile,launchPetTestBrowser} from './helpers/petBrowserProcess.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const profile=petTestProfile(),proc=launchPetTestBrowser(findPetTestBrowser(),port,profile);
const out=path.resolve('.seer-cache/dido-review');fs.mkdirSync(out,{recursive:true});let ws;
try{
 let target;for(let i=0;i<100;i++){try{target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(100);}}
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let serial=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')console.error(JSON.stringify(m.params));if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,t=setTimeout(()=>reject(Error(method+' timeout')),120000);pending.set(id,{resolve:r=>{clearTimeout(t);resolve(r);},reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1000,height:850,deviceScaleFactor:1,mobile:false});
 console.log('navigate',await send('Page.navigate',{url:'http://127.0.0.1:3037/tests/fixtures/candidateReview.html'}));await send('Page.bringToFront');
 let ready=false;for(let i=0;i<600;i++){if(await evaluate('window.reviewReady===true').catch(()=>false)){ready=true;break;}await sleep(100);}if(!ready)throw Error(JSON.stringify(await evaluate('({url:location.href,text:document.body.innerText,html:document.documentElement.outerHTML.slice(-1000),resources:performance.getEntriesByType("resource").slice(-8).map(x=>x.name)})')));
 const records=[];
 for(const id of [4377,1400467,1400473,1400748,1400887]){
  records.push(await evaluate(`window.reviewCandidate(${id})`));await sleep(500);
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${id}-standby.png`),Buffer.from(shot.data,'base64'));
  console.log('Captured native source '+id);
 }
 fs.writeFileSync(path.join(out,'records.json'),JSON.stringify(records,null,2)+'\n');
}finally{ws?.close();closePetTestBrowser(proc,profile);}
