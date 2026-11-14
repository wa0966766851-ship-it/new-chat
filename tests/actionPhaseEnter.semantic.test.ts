import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_FLAME_LIFECYCLE_KIT,IMMORTAL_AINS_FLAME_STATUS_KIT,IMMORTAL_AINS_FLAME_ACTION_KIT,IMMORTAL_FLAME_SACRIFICED} from '../src/data/immortalAinsFlameKit';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const entry=(acts:any[])=>({codeId:'effect_sequence',node:'battle_start',source:'soulmark',role:'innate',order:0,customText:'測試正式初始化',params:{clause:{raw:'測試正式初始化',trig:'battle_start',parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}});
const soul=(kit:any[])=>({name:'測試神焰',description:'已核對神焰片段',effectMode:'kit',effectType:'custom',kit});
try{
 defineCustomBlocks();
 for(const e of IMMORTAL_AINS_FLAME_ACTION_KIT){
  assert.equal(sequenceIssue(e.params.clause,e.node),null);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{buildEntryBlock(w as any,e);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('soulmark')(r.getTopBlocks(false)[0],e.node,e.order),e);}finally{w.dispose();r.dispose();}
 }
 assert.ok(sequenceIssue({raw:'錯置容器',trig:'use',parsed:true,body:[{acts:[{op:'with_event_elf',p:{body:[]},label:'錯置'}]}]}));
 for(const side of ['p1','p2'] as const){
  async function play(control:'none'|'self'|'opp'|'both',burn=true,sacrificed=false,sourceActive=false){
   const init=(burn?[{op:'status',p:{side:'self',status:'燒傷',chance:100,turns:3}}]:[]);
   if(control==='self'||control==='both')init.push({op:'status',p:{side:'self',status:'麻痺',chance:100,turns:3}});
   const kit=[...IMMORTAL_AINS_FLAME_STATUS_KIT,...IMMORTAL_AINS_FLAME_ACTION_KIT,
    ...(sacrificed?[entry([{op:'flag_set',p:{key:IMMORTAL_FLAME_SACRIFICED,value:true}}])]:IMMORTAL_AINS_FLAME_LIFECYCLE_KIT.filter(e=>e.node==='battle_start'))];
   const source=h.unit('來源',4000,[h.wait()],{speed:200,maxHp:10000,extra:{soulMark:soul(sourceActive?[...kit,entry(init)]:kit)}});
   const holder=sourceActive?source:h.unit('受益者',1000,[h.wait()],{speed:200,maxHp:10000,extra:{soulMark:soul([entry(init)])}});
   const opp=h.unit('對手',10000,[h.wait()],{extra:{soulMark:soul(control==='opp'||control==='both'?[entry([{op:'status',p:{side:'self',status:'麻痺',chance:100,turns:3}}])]:[])}});
   return (await h.play(side,{self:holder,selfBench:sourceActive?[]:[source],opp},1))[0];
  }
  for(const control of ['none','self','opp','both'] as const){
   const result=await play(control);
   assert.equal(result.opp.currentHp,6000,`${side}/${control} 兩個出手階段各汲取2000；${result.logs.join('\n')}`);
   assert.equal(result.self.currentHp,5000,`${side}/${control} 回復真正的在場燒傷持有者`);
   assert.equal(result.state[`${side}Team`].find((e:any)=>e.id==='來源').currentHp,4000,'不能回復後排來源');
   if(control==='self'||control==='both')assert.ok(result.logs.some((s:string)=>s.includes('因異常狀態無法行動')),'確認確實受控');
  }
  const normal=await play('none',false);assert.equal(normal.opp.currentHp,10000,'沒有燒傷不觸發');
  const ally=await play('none',true,true);assert.equal(ally.opp.currentHp,10000,'犧牲後隊友失去汲取');
  const owner=await play('self',true,true,true);assert.equal(owner.opp.currentHp,6000,'犧牲後來源自身受控仍保留兩次汲取');
  console.log(`✓ ${side} 雙方出手階段含受控、後排來源與受益者隔離、犧牲後範圍、積木往返`);
 }
}finally{await h.close();}
