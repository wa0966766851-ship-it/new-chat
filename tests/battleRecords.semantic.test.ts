import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import express from 'express';
import {BattleRecordStore,battleRecordDirectory,validRecordId} from '../server/battleAI/recordStore';
import {registerBattleAI} from '../server/battleAI/routes';
import {createBattleRecorder} from '../src/battle/records/recorder';
import {cleanRecordData,type BattleRecordEvent} from '../src/battle/records/schema';
const base=path.resolve('.seer-cache'),directory=path.join(base,'record-test-'+randomUUID());
const event=(kind:BattleRecordEvent['kind']='logs',data:any={rows:[{turn:1,text:'測試訊息'}]}):BattleRecordEvent=>({kind,at:new Date().toISOString(),data});
const id=(i:number)=>`${1700000000000+i}-${randomUUID()}`;
const store=new BattleRecordStore(directory);
let checks=0;const check=async(name:string,run:()=>any)=>{await run();checks++;console.log('✓ '+name);};
let routeDirectory:string|undefined;
try{
  await check('只保留最近10場，依建立時間淘汰；不刪除其他檔案',async()=>{
    await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'keep.txt'),'保留');
    for(let i=0;i<12;i++)await store.append(id(i),[event()],true);
    const files=await store.list();assert.equal(files.length,10);assert.ok(files.every(f=>Number(f.id.slice(0,13))>=1700000000002));assert.equal(await fs.readFile(path.join(directory,'keep.txt'),'utf8'),'保留');
  });
  await check('循序追加、外部直接刪除後不重建、路徑穿越拒絕',async()=>{
    const latest=(await store.list())[0];await Promise.all([store.append(latest.id,[event('logs',{rows:['A']})]),store.append(latest.id,[event('logs',{rows:['B']})])]);
    const text=await store.read(latest.id);assert.ok(text.includes('"A"'));assert.ok(text.indexOf('"A"')<text.indexOf('"B"'));
    await fs.unlink(path.join(directory,latest.name));await assert.rejects(store.append(latest.id,[event()]),{code:'ENOENT'});assert.equal((await store.list()).length,9);
    await assert.rejects(store.read('../../outside'),/INVALID_ID/);assert.equal(validRecordId('../x'),false);
  });
  await check('記錄遮蔽憑證及執行碼，保留模型用量與數值',async()=>{
    const key='AQ.TEST_ONLY_NOT_A_REAL_KEY_0123456789';
    const value=cleanRecordData({apiKey:key,session:'bad',customCode:'bad',model:{inputTokens:200,confidence:0.8},text:'憑證 '+key,header:'Bearer abc123'});
    const target=id(20);await store.append(target,[event('decision',value)],true);const text=await store.read(target);
    assert.ok(!text.includes(key));assert.ok(!text.includes('customCode'));assert.ok(text.includes('inputTokens'));assert.ok(text.includes('200'));assert.ok(text.includes('金鑰已隱去'));
  });
  await check('重送同批不重複寫入',async()=>{
    const matchId=id(24);
    await store.append(matchId,[event('action',{name:'唯一出招'})],true,1);
    await store.append(matchId,[event('action',{name:'唯一出招'})],true,1);
    assert.equal((await store.read(matchId)).split('唯一出招').length,2);
  });
  const elf={id:'A',battleId:'A',name:'A',type:'普通',currentHp:100,maxHp:100,skills:[{name:'攻擊',pp:10}],statStages:{}};
  const st:any={p1:elf,p2:{...elf,id:'B',battleId:'B'},p1Team:[elf],p2Team:[{...elf,id:'B',battleId:'B'}],p1ActiveIndex:0,p2ActiveIndex:0,p1Timers:[],p2Timers:[],p1Marks:[],p2Marks:[],turnNumber:1,phase:'p1_select',logs:[]};
  await check('450則訊息不受畫面400上限影響；開局只寫一次且記錄獨立於介面說明',async()=>{
    const batches:any[]=[];const recorder=createBattleRecorder({battleMode:'PVE'},async(id,events,create)=>{batches.push({id,events,create});},()=>true);
    recorder.observe(st);for(let i=0;i<450;i++){st.logs=[...st.logs,{turn:1,text:`LOG_${i}`}].slice(-400);recorder.observe(st);}
    const flush=recorder.flush();recorder.decision({side:'p2',turn:1,action:{kind:'skill',slot:0},candidates:[],assumptions:[],model:{status:'used',confidence:0.8,inputTokens:23}} as any);await flush;await recorder.flush();
    const events=batches.flatMap(b=>b.events);assert.equal(events.filter(e=>e.kind==='start').length,1);assert.equal(batches.filter(b=>b.create).length,1);
    assert.equal(events.filter(e=>e.kind==='logs').flatMap(e=>e.data.rows).length,450);assert.equal(events.find(e=>e.kind==='decision').data.model.inputTokens,23);
    recorder.action({turn:1,side:"p1",stage:"selected",kind:"skill",name:"攻擊"});
    recorder.action({turn:1,side:"p2",stage:"selected",kind:"wait",name:"空過"});
    st.winner='p1';recorder.finish(st);await recorder.flush();assert.equal(batches.flatMap(b=>b.events).filter(e=>e.kind==='end').length,1);assert.deepEqual(batches.flatMap(b=>b.events).find(e=>e.kind==='end').data.actions,{p1:1,p2:1});delete st.winner;
  });
  await check('戰報未變的狀態更新不重新掃描，新增訊息仍寫入', async () => {
    const written: BattleRecordEvent[] = [];
    const recorder = createBattleRecorder({}, async (_id, events) => { written.push(...events); }, () => true);
    const logs = [{turn: 1, text: '原有訊息'}];
    let scans = 0;
    logs.indexOf = function (entry) { scans++; return Array.prototype.indexOf.call(this, entry); };
    logs.lastIndexOf = function (entry) { scans++; return Array.prototype.lastIndexOf.call(this, entry); };
    recorder.observe({...st, logs});
    for (let n = 0; n < 100; n++) recorder.observe({...st, logs, p1: {...st.p1, currentHp: 100 - n}});
    assert.equal(scans, 0);
    logs.push({turn: 1, text: '新訊息'});
    recorder.observe({...st, logs});
    assert.equal(scans, 1);
    await recorder.flush();
    assert.deepEqual(written.filter(e => e.kind === 'logs').flatMap(e => (e.data.rows as {text:string}[]).map(row => row.text)), ['原有訊息', '新訊息']);
  });
  await check('關閉時零寫入；儲存失敗不影響戰鬥且不重複重試',async()=>{
    let calls=0;const off=createBattleRecorder({},async()=>{calls++;},()=>false);off.observe(st);off.finish(st);await off.flush();assert.equal(calls,0);
    const broken=createBattleRecorder({},async()=>{calls++;throw Error('記錄已刪除');},()=>true);broken.observe(st);await broken.flush();broken.observe(st);await broken.flush();assert.equal(calls,1);broken.finish(st);
  });
  await check('本機記錄路由、會話驗證、TXT下載、單場刪除與舊戰報補存',async()=>{
    const root=path.join(base,'route-test-'+randomUUID());routeDirectory=battleRecordDirectory(root);
    const app=express();app.use(express.json({limit:'256kb'}));registerBattleAI(app,root);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
    const url=`http://127.0.0.1:${(server.address() as any).port}`;
    try{
      const status=await(await fetch(url+'/api/battle-ai/status')).json();
      const post=(route:string,body:any,token=status.session)=>fetch(url+'/api/battle-ai/records'+route,{method:'POST',headers:{Origin:url,'Content-Type':'application/json','x-seer-ai-session':token},body:JSON.stringify(body)});
      const target=id(30);assert.equal((await post('',{id:target,create:true,events:[event('import',{text:'第38回合 對手獲勝',coverage:'部分舊戰報'})]},'wrong')).status,403);
      assert.equal((await post('',{id:target,create:true,events:[event('import',{text:'第38回合 對手獲勝',coverage:'部分舊戰報'})]})).status,200);
      const list=await(await fetch(url+'/api/battle-ai/records')).json();assert.equal(list.files.length,1);assert.equal(list.limit,10);
      const download=await fetch(url+'/api/battle-ai/records/'+target);assert.ok(download.headers.get('content-type')?.includes('text/plain'));assert.ok((await download.text()).includes('對手獲勝'));
      assert.equal((await post('/delete',{id:target})).status,200);assert.equal((await post('',{id:target,create:false,events:[event()]})).status,410);
      assert.equal((await fetch(url+'/api/battle-ai/records',{headers:{Origin:'https://evil.example'}})).status,403);
    }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
  });
  console.log(`${checks} 組對戰記錄測試通過`);
}finally{
  assert.equal(path.dirname(directory),base);await fs.rm(directory,{recursive:true,force:true});
  if(routeDirectory){assert.equal(path.basename(routeDirectory),'battle-records');assert.ok(routeDirectory.startsWith(path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.config'),'SeerBattle')+path.sep));await fs.rm(routeDirectory,{recursive:true,force:true});}
}
