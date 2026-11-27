import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {initializePlayerSave,flushPlayerSaveNow} from '../src/utils/playerSaveBridge';
const dom=new JSDOM('<body></body>',{url:'http://localhost:45678'});
Object.assign(globalThis,{document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage});
let disk={schema:1,revision:'0',entries:{} as Record<string,string>},counter=0,blocked=false,release:(()=>void)|undefined,delay=false;
const response=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const request:typeof fetch=async(_url,options)=>{
 if(options?.method!=='POST')return response(disk);
 if(delay){delay=false;await new Promise<void>(r=>{release=r;});}
 if(blocked)return response({},409);
 const body=JSON.parse(String(options.body));assert.equal(body.revision,disk.revision);disk={schema:1,revision:String(++counter),entries:body.entries};return response(disk);
};
let bridge:Awaited<ReturnType<typeof initializePlayerSave>>;
try{
 const storage=dom.window.localStorage;
 bridge=await initializePlayerSave(storage,request);assert.ok(bridge);
 storage.setItem('seer_p1_suit','first');delay=true;
 const first=bridge.flush();while(!release)await new Promise(r=>setTimeout(r,1));
 storage.setItem('seer_p1_suit','second');const final=flushPlayerSaveNow();release();await first;await final;
 assert.equal(disk.entries.seer_p1_suit,'second','重新載入前須等待目前同步，再保存同步期間的新配置');
 bridge.stop();await assert.rejects(()=>flushPlayerSaveNow(),/同步已暫停/);
 storage.clear();bridge=await initializePlayerSave(storage,request);assert.equal(storage.getItem('seer_p1_suit'),'second','重啟確實帶回最新配置，不是舊磁碟副本');
 storage.setItem('seer_p1_suit','third');blocked=true;await assert.rejects(()=>flushPlayerSaveNow(),/同步未完成/);assert.equal(storage.getItem('seer_p1_suit'),'third');assert.equal(disk.entries.seer_p1_suit,'second');
 bridge?.stop();bridge=await initializePlayerSave(storage,async()=>response({schema:99,revision:'bad',entries:{}}));await assert.rejects(()=>flushPlayerSaveNow(),/同步目前不可用/);
 console.log('配置帶入桌面同步：忙碌等待、最新資料落盤、重新啟動、409衝突及損壞存檔阻擋通過');
}finally{bridge?.stop();dom.window.close();}
