import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {PEGASUS_READY_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/pegasusSkills.ts');
 const {PEGASUS_SOUL_KIT:soul}=await h.server.ssrLoadModule('/src/data/pegasusSoulKit.ts');
 const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 defineCustomBlocks();
 for(const entry of soul){assert.equal(sequenceIssue(entry.params.clause,entry.node),null,entry.customText);const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}}
 for(const sk of skills){h.assertKitOnly(sk);for(const entry of sk.kit){assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,`${sk.name}/${entry.customText}`);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}
 }}
 const violet=skills[1];
 for(const side of ['p1','p2'] as const){
  for(const hit of [false,true]){
   const chosen=structuredClone(violet);if(!hit){chosen.isSureHit=false;chosen.accuracy=0;chosen.kit=chosen.kit.filter((e:any)=>e.params.property!=='sure_hit');}
   // 隔離吸取期限與其命中閘門，其他能力／增傷積木另測。
   chosen.power=0;chosen.kit=chosen.kit.filter((e:any)=>e.order===0||e.order===4);
   const rows=await h.play(side,{self:h.unit('S',1000,[chosen,h.wait()],{maxHp:100000,speed:300}),opp:h.unit('E',100000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
   if(hit){assert.equal(rows[0].opp.currentHp,25000,'首次命中後吸取25%與額外50%');assert.ok(rows[1].opp.currentHp<rows[0].opp.currentHp,'後續等待技能仍觸發');}
   else{assert.equal(rows[0].opp.currentHp,100000,'首次未命中不能吸取');assert.equal(rows[1].opp.currentHp,100000,'首次未命中不能留下五回合效果');}
  }
  const boost=structuredClone(violet);boost.kit=boost.kit.filter((x:any)=>x.order===0||x.order===5||x.order===6);
  const attack={...h.wait(),name:'普通測試攻擊',category:'特殊',power:100};
  const baseline={...structuredClone(boost),kit:boost.kit.filter((x:any)=>x.order===0)};
  const [base]=await h.play(side,{self:h.unit('S',100000,[baseline],{extra:{critValue:0}}),opp:h.unit('E',100000,[h.wait()])});
  const rows=await h.play(side,{self:h.unit('S',100000,[boost,h.wait(),attack],{extra:{critValue:0}}),opp:h.unit('E',100000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:t===2?1:2,0]},4);
  const damage=100000-base.opp.currentHp;
  assert.ok(Math.abs((100000-rows[0].opp.currentHp)/damage-2.5)<.1,'本次只增傷150%，不能再吃掉下次增傷');
  const nextDamage=rows[1].opp.currentHp-rows[2].opp.currentHp,laterDamage=rows[2].opp.currentHp-rows[3].opp.currentHp;
  assert.ok(nextDamage/laterDamage>2.2&&nextDamage/laterDamage<2.8,'等待不消耗下次攻擊增傷；使用一次後恢復正常傷害');
  assert.equal(rows[1].state[side+'Timers'].find((t:any)=>t.payload?.block?.prio===2)?.remaining,2,'屬性技能不消耗下兩次攻擊先制');
  assert.equal(rows[2].state[side+'Timers'].find((t:any)=>t.payload?.block?.prio===2)?.remaining,1,'第一次後續攻擊消耗一次先制');
  const gap=structuredClone(violet);gap.power=0;gap.kit=gap.kit.filter((x:any)=>x.order===0||x.order===3);
  for(const extraStage of [0,1]){
   const [r]=await h.play(side,{self:h.unit('S',100000,[gap],{statStages:{atk:extraStage}}),opp:h.unit('E',100000,[h.wait()])});
   const other=side==='p1'?'p2':'p1';
   assert.equal(r.state[other+'Timers'].some((t:any)=>t.remaining>0&&t.payload?.block?.addInvalid==='all'),extraStage===1,'等級差12不觸發，13才封附加');
  }
 }
 for(const side of ['p1','p2'] as const){
  const chosen=structuredClone(violet);chosen.power=0;chosen.kit=chosen.kit.filter((e:any)=>e.order===0||e.order===4);
  for(const hp of [40000,60000,100000]){
   const [r]=await h.play(side,{self:h.unit('S',hp,[chosen],{maxHp:100000,speed:300}),opp:h.unit('E',100000,[h.wait()])});
   assert.equal(r.opp.currentHp,hp<50000?25000:75000,'額外吸取條件取本次開始前的體力');
   assert.equal(h.statuses(r.opp).includes('睡眠'),hp===100000,'整次吸取沒有實際回血才催眠');
  }
 }
 console.log('pegasusFoundation passed: five skill contracts/Blockly, P1/P2 first-hit gate and subsequent skill-use absorption');
}finally{await h.close();}
