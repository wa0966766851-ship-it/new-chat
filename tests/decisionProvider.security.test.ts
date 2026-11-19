import assert from 'node:assert/strict';
import express from 'express';
import {registerBattleAI,isLocalDecisionRequest} from '../server/battleAI/routes';
import {geminiDecision} from '../server/battleAI/geminiDecision';
import {createSecretStore} from '../server/battleAI/secretStore';
import {validDecisionKey,extractDecisionKeys} from '../server/battleAI/keyFormat';

const key='TEST_ONLY_NOT_A_REAL_API_KEY_123456789';
assert.equal(validDecisionKey('AQ.AUTH_TEST_ONLY_NOT_A_REAL_KEY.0123456789_-'),true);
assert.equal(validDecisionKey('AQ.AUTH_TEST_ONLY_NOT_A_REAL_KEY\nInjected'),false);
assert.equal(validDecisionKey('AQ.'+'x'.repeat(1024)),false);
assert.equal(extractDecisionKeys('帳號1: AQ.AUTH_TEST_ONLY_NOT_A_REAL_KEY.0123456789_-\n帳號2: AQ.AUTH_TEST_ONLY_NOT_A_REAL_KEY.0123456789_-').length,1);
let calls=0;
const transport:any=async(url:string,init:any)=>{calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/decisions');assert.equal(init.headers['x-goog-api-key'],key);assert.ok(!url.includes(key));const body=JSON.parse(init.body);assert.equal(body.model,'gemini-decision-1');assert.equal(body.questions.action.type,'choice');return new Response(JSON.stringify({answers:{action:{type:'choice',choice:'a0',confidence:0.8}},usage:{total_input_tokens:12}}));};
const input={context:{turn:1},candidates:[{id:'a0',label:'test',score:1}]};
assert.deepEqual(await geminiDecision(key,input,1000,undefined,transport),{choice:'a0',confidence:0.8,inputTokens:12});assert.equal(calls,1);
await assert.rejects(geminiDecision(key,input,1000,undefined,async()=>new Response(JSON.stringify({error:{message:key}}),{status:403})),/^Error: PROVIDER_403$/);
await assert.rejects(geminiDecision(key,input,1000,undefined,async()=>new Response(JSON.stringify({answers:{action:{type:'choice',choice:'arbitrary_action',confidence:1}}}))),/INVALID_ANSWER/);
for(const [address,host,origin] of [['192.168.1.2','127.0.0.1:3000',undefined],['127.0.0.1','evil.example:3000',undefined],['127.0.0.1','127.0.0.1:3000','https://evil.example']])assert.equal(isLocalDecisionRequest({socket:{remoteAddress:address},headers:{host,origin}} as any),false);
const store=createSecretStore(process.cwd()+'/test-isolated-vault');await store.set(key);assert.equal(await store.get(),key);assert.equal((await store.status()).remembered,false);assert.ok(!JSON.stringify(await store.status()).includes(key));await store.set();
if(process.platform === 'win32') {
  await store.set(key,true);assert.equal((await store.status()).remembered,true);
  const restored=createSecretStore(process.cwd()+'/test-isolated-vault');assert.equal(await restored.get(),key);await restored.set();
}
const app=express();app.use(express.json());registerBattleAI(app,process.cwd()+'/test-isolated-vault');
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',()=>r()));
const url=`http://127.0.0.1:${(server.address() as any).port}`;
try {
  const initial=await(await fetch(url+'/api/battle-ai/status')).json();assert.equal(initial.configured,false);assert.ok(initial.session);
  assert.equal((await fetch(url+'/api/battle-ai/key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,remember:false})})).status,403);
  assert.equal((await fetch(url+'/api/battle-ai/status',{headers:{Origin:'https://evil.example'}})).status,403);
  const post=(path:string,body:any)=>fetch(url+'/api/battle-ai/'+path,{method:'POST',headers:{Origin:url,'Content-Type':'application/json','x-seer-ai-session':initial.session},body:JSON.stringify(body)});
  assert.equal((await post('key',{key,remember:false})).status,200);
  const status=await(await fetch(url+'/api/battle-ai/status')).json();assert.equal(status.configured,true);assert.ok(!JSON.stringify(status).includes(key));
  assert.equal((await post('decide',{timeoutMs:1000,input:{context:{},candidates:[{id:'bad',label:'bad',score:1}]}})).status,400);
  assert.equal((await post('key',{key:'',remember:false})).status,200);assert.equal((await post('decide',{timeoutMs:1000,input})).status,503);
  console.log('✓ 決策供應商格式、錯誤去秘密、loopback／同源／會話防護、記憶體金鑰儲存與刪除');
} finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
