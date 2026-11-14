import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {authoredEntry:e,authoredSkill:skill,operation:a,actions:act,condition:c}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const entries=[e('兩回合內自身回合類效果不會減少（包含自身）','use',[act(a('immune_status_turns',{turns:5,reflect:true}),a('turn_key_set',{side:'self',key:'sampleTurns',turns:5,label:'鏡像計數'}),a('freeze_turn_effects',{turns:2}),a('crit_turns',{turns:2,next:true}),a('sure_hit_turns',{turns:2,next:true}),a('timed',{turns:1,from:'now',trig:'opp_attack',once:true,body:[act(a('noop'))],onExpire:[act(a('flag_set',{key:'expiryFired',value:true}))]}))],0),
  e('進入能力階段','entrance',[act(a('phase_enter',{key:'testCycle',name:'normal'}))],0,'soulmark'),
  e('首次致死重生並提升60%','fatal',[act(a('phase_enter',{key:'testCycle',name:'potential',turns:4,statsMultiplier:1.6,restoreHp:true}))],1,'soulmark',true,[c('phase',{key:'testCycle',name:'normal'})]),
  e('四回合後能力降低60%','phase_end',[act(a('phase_expire',{key:'testCycle',name:'spent',statsMultiplier:.4}))],2,'soulmark'),
  e('下場還原','switch_out',[act(a('phase_leave',{key:'testCycle'}))],3,'soulmark')];
 defineCustomBlocks();
 for(const entry of entries){assert.equal(sequenceIssue(entry.params.clause,entry.node),null);const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}}
 for(const side of ['p1','p2'] as const){
  const sk=skill('凍結驗證','無屬性','屬性',0,20,0,[entries[0]],{sure:true});
  const rows=await h.play(side,{self:h.unit('S',10000,[sk,h.wait()],{speed:200}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()]),turns:(_e:any,t:number)=>t===1?[0,0]:t===7?[{switch:1},0]:t===8?[{switch:0},0]:[1,0]},8);
  for(const row of rows.slice(0,6)){
   const timers=row.state[side+'Timers'];assert.equal(timers.find((t:any)=>t.payload?.block?.freezeTurnEffects)?.remaining,2);
   assert.equal(row.state[side+'RegistryState'].sampleTurns,5,'鏡像回合鍵也不得減少');
   assert.notEqual(row.state[side+'RegistryState'].expiryFired,true,'凍結期限尚未到期，不執行自然到期分支');
   for(const key of ['crit','sureHit']){const timer=timers.find((t:any)=>t.payload?.block?.[key]);assert.equal(timer?.pendingActivation,false,'凍結倒數仍須啟用下回合效果');assert.equal(timer?.remaining,2);}
  }
  assert.ok(!rows[7].state[side+'Timers'].some((t:any)=>t.payload?.block?.freezeTurnEffects),'離場後凍結器不保留');
  const soul={name:'階段驗證',effectMode:'kit',kit:entries.slice(1)};
  const hit=h.kitSkill('第一回合致死',[a('dmg',{flat:20000,type:'真實'})]);
  const phases=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',100000,[hit,h.wait()]),turns:(_e:any,t:number)=>t===5?[{switch:1},1]:[0,t===1?0:1]},5);
  assert.equal(phases[0].self.combatPhases.testCycle.phase,'potential');assert.equal(phases[0].self.currentHp,16000);assert.equal(phases[0].self.calculatedStats.atk,480);
  assert.equal(phases[2].self.combatPhases.testCycle.phase,'potential');assert.equal(phases[3].self.combatPhases.testCycle.phase,'spent');assert.equal(phases[3].self.calculatedStats.atk,120);
  assert.equal(phases[4].state[side+'Team'][0].calculatedStats.atk,300,'離場恢復基礎能力');
 }
 console.log('combatWindows passed: freeze includes itself and registry counters, switch cleanup, phase rebirth/expiry/restoration and Blockly save/reload');
}finally{await h.close();}
