import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {DIFU_READY_SOUL_KIT:kit}=await h.server.ssrLoadModule('/src/data/difuSoulKit.ts');
 const {DIFU_AMULET:item,DIFU_AMULET_ID:id}=await h.server.ssrLoadModule('/src/data/difuItem.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
 defineCustomBlocks();
 for(const entry of kit){
  assert.equal(sequenceIssue(entry.params.clause,entry.node),null);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}
 }
 for(const side of ['p1','p2'] as const)for(const bench of [false,true]){
  const source=h.unit('source',2000,[h.wait()],{maxHp:5000,extra:{calculatedStats:{hp:5000,atk:70,def:117,spatk:777,spdef:117,speed:100},soulMark:{name:'護符魂印',effectMode:'kit',kit}}});
  const [r]=await h.play(side,{self:bench?h.unit('active',5000,[h.wait()]):source,selfBench:bench?[source]:[],opp:h.unit('enemy',10000,[h.wait()])});
  assert.equal(r.state[`${side}ItemInventory`][id].left,1);
  assert.equal(r.state[`${side}ItemInventory`][id].snapshot.stats.spatk,777);
  assert.equal(r.state[`${side}ItemInventory`][id].snapshot.sourceBattleId,'source');
 }
 // 從正式道具入口用掉，再由重設後的第一個在場回合重新取得；無回合類效果也必須重發。
 for(const side of ['p1','p2'] as const)for(const withTimer of [false,true]){
  const source=h.unit('source',2000,[h.wait()],{maxHp:5000,speed:200,extra:{soulMark:{name:'護符魂印',effectMode:'kit',kit}}});
  const enemy=h.unit('enemy',10000,[withTimer?h.turnEffectSkill():h.wait()],{speed:100});
  const p1=side==='p1'?source:enemy,p2=side==='p2'?source:enemy;
  const engine=createBattleEngine({initialP1Team:[p1],initialP2Team:[p2],p1StarterId:p1.id,p2StarterId:p2.id,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
  try{
   engine.mount();engine.start();await engine.idle();
   // 第1回合先讓對手設置回合效果；第2回合用護符，第3回合開始檢查重發。
   for(let turn=1;turn<=3;turn++){
    const st=engine.getState();
    for(const s of ['p1','p2'] as const){if(s===side&&turn===2)engine.onUseItem(s,item);else engine.onSkillSelect(s,st[s].skills[0]);}
    await engine.idle();
   }
   const st=engine.getState();
   assert.equal(st[`${side}ItemInventory`][id].left,1,JSON.stringify({side,withTimer,logs:st.logs,registry:st[`${side}RegistryState`]}));
   assert.equal(st[`${side}ItemInventory`][id].snapshot.sourceBattleId,'source');
   const enemySide=side==='p1'?'p2':'p1';
   assert.equal(h.statuses(st[enemySide]).includes('神悔'),withTimer,'消除成功才神悔，失敗仍發護符');
  }finally{engine.unmount();}
 }
 console.log('difuSoulFoundation passed');
}finally{await h.close();}
