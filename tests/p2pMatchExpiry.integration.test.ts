import assert from 'node:assert/strict';
import express from 'express';
import {matchmakingRouter} from '../server/p2pMatchmaking';
import {P2P_RULES_VERSION} from '../src/online/protocol';
let now=100000;const closed:string[]=[];
const admission=(seat:'host'|'guest')=>({code:'0123456789abcdef',token:seat,seat,rtc:{}});
const app=express();app.use(express.json());app.use('/match',matchmakingRouter(()=>[admission('host'),admission('guest')],code=>closed.push(code),()=>now));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(done=>server.once('listening',done));
const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
const enter=()=>fetch(origin+'/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:P2P_RULES_VERSION,mode:'peak'})}).then(r=>r.json());
const poll=(t:any)=>fetch(origin+'/match/'+t.id,{headers:{Authorization:'Bearer '+t.token}});
try{
 const a=await enter();assert.equal(a.expires-now,120000);
 now+=120001;assert.equal((await poll(a)).status,404,'等待截止後票券失效');
 const b=await enter(),c=await enter();
 const result=await (await poll(b)).json();assert.equal(result.state,'matched');assert.equal(result.expires-now,60000);
 now+=60001;assert.equal((await poll(c)).status,404,'配對結果過期不保留房間');
 assert.ok(closed.includes('0123456789abcdef'));
 console.log('配對等待120秒截止、結果60秒領取期限及過期房間清理通過');
}finally{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
