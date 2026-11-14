import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();let catalog:any[],fixture:any;
try{
 const {BATTLE_ITEMS,getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');catalog=BATTLE_ITEMS;
 const {authoredEntry:e,operation:a,actions:act,condition:c}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 const {heldBattleItemProgramIssue}=await h.server.ssrLoadModule('/src/effects/battleItemProgram.ts');
 const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const id='snapshot_drain_fixture';
 const entry=(type:string,perTurn:number)=>e('測試道具紀錄逐次汲取',type==='true'?'damaged_true':'damaged_nontrue',[act(a('item_snapshot_drains',{itemId:id,stat:'spatk',ratio:.01,type,status:'山神守護',perTurn}))],0,'soulmark',true,type==='true'?[]:[c('owner_on_field')]);
 fixture={id,name:'紀錄汲取測試',type:'special',grantOnly:true,holdLimit:1,retainStatusDuration:['山神守護'],heldKit:[entry('fixed',15),entry('true',30)]};
 catalog.push(fixture);assert.equal(heldBattleItemProgramIssue(fixture),null);
 const invalid=structuredClone(fixture.heldKit[0]);invalid.params.clause.body[0].acts[0].p.type='不明';assert.ok(sequenceIssue(invalid.params.clause,invalid.node));
 const wrongTiming=structuredClone(fixture.heldKit[0]);wrongTiming.node='on_entered';wrongTiming.params.clause.trig='entrance';assert.ok(sequenceIssue(wrongTiming.params.clause,wrongTiming.node));
 defineCustomBlocks();for(const entry of fixture.heldKit){const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}}
 const grant=e('取得測試道具','battle_start',[act(a('grant_item',{side:'self',itemId:id,count:1,snapshotStats:true}))],0,'soulmark',true);
 const guarded=(n:number)=>n?{battleStatuses:{山神守護:n},effects:[{id:'山神守護',name:'山神守護',duration:n,stacks:1}]}:{};
 const source=(n=0)=>h.unit('source',10000,[h.wait()],{maxHp:20000,speed:200,extra:{...guarded(n),calculatedStats:{hp:20000,atk:300,def:300,spatk:1000,spdef:300,speed:200},soulMark:{name:'道具取得',effectMode:'kit',kit:[grant]}}});
 for(const side of ['p1','p2'] as const)for(const type of ['固定','真實'])for(const n of [0,1,3]){
  const hit=h.kitSkill('指定傷害',[{op:'dmg',p:{flat:100,type}}]);
  const [r]=await h.play(side,{self:source(n),opp:h.unit('enemy',10000,[hit])});
  const expected=10*(1+n*(type==='真實'?30:15));
  assert.equal(r.opp.currentHp,10000-expected,JSON.stringify({side,type,n,logs:r.logs}));
  assert.equal(r.self.currentHp,9900+expected,'吸取回復來自在場者，數值依加入時特攻');
 }
 // 每份都受正式固定傷害上限，不可把46份合成460後只套一次上限。
 for(const side of ['p1','p2'] as const){
  const cap=e('固定傷害上限','entrance',[act(a('damage_cap_turns',{side:'self',dir:'in',kind:'固定',cap:4,turns:10}))],0,'soulmark',true);
  assert.equal(sequenceIssue(cap.params.clause,cap.node),null);
  const hit=h.kitSkill('固定受擊',[{op:'dmg',p:{flat:100,type:'固定'}}]);
  const [r]=await h.play(side,{self:source(3),opp:h.unit('enemy',10000,[hit],{extra:{soulMark:{name:'份數上限',effectMode:'kit',kit:[cap]}}})});
  assert.equal(r.opp.currentHp,10000-46*4);assert.equal(r.self.currentHp,9900+46*4);
 }
 // 板凳受擊：真實汲取份數取板凳守護期限，回復給場上；非真實不觸發。
 const R=getBattleSkillRegistry(),name='指定板凳傷害測試';
 try{
  for(const side of ['p1','p2'] as const)for(const type of ['true','fixed']){
   R[name]=(ctx:any)=>{ctx.applyDamageToElf(ctx.targetSide,'bench',100,type);return true;};
   const [r]=await h.play(side,{self:source(),selfBench:[h.unit('bench',5000,[h.wait()],{extra:guarded(4)})],opp:h.unit('enemy',10000,[{...h.wait(),name}])});
   const expected=type==='true'?10*(1+4*30):0;
   assert.equal(r.opp.currentHp,10000-expected,JSON.stringify({side,type,logs:r.logs}));assert.equal(r.self.currentHp,10000+expected);
   const bench=r.state[`${side}Team`].find((e:any)=>e.id==='bench');assert.equal(bench.currentHp,4900);assert.equal(getStatuses(bench).山神守護,4);
  }
 }finally{delete R[name];}
 console.log('itemSnapshotDrains passed');
}finally{if(catalog&&fixture)catalog.splice(catalog.indexOf(fixture),1);await h.close();}
