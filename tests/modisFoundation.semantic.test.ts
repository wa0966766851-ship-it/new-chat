import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {sequenceIssue} from '../src/effects/sequenceContract';
import {settlementChainOperations} from '../src/blocks/ops/settlementChains';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {MODIS_SHADOW:shadow,MODIS_ABYSS:abyss,MODIS_INSCRIPTION:inscription,MODIS_SKILLS:skills,MODIS_REVERSE_SLASH:slash,MODIS_STAR_BIND:fifth}=await h.server.ssrLoadModule('/src/data/modisSkills.ts');
 const {MODIS_DAMAGE_SOUL_KIT:damageKit}=await h.server.ssrLoadModule('/src/data/modisSoulKit.ts');
 const {MODIS_SOUL_KIT:soulKit}=await h.server.ssrLoadModule('/src/data/modisSoulKit.ts');
 defineCustomBlocks();
 for(const e of soulKit){
  assert.equal(sequenceIssue(e.params.clause,e.node),null,e.customText);
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(ws as any,e));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(e.source)(b,e.node,e.order)),[e]);}finally{ws.dispose();reload.dispose();}
 }
 for(const s of skills){
  h.assertKitOnly(s);
  for(const e of s.kit){
   if(e.codeId==='effect_sequence')assert.equal(sequenceIssue(e.params.clause,e.node),null,e.customText);
   const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
   try{assert.ok(buildEntryBlock(ws as any,e));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(e.source)(b,e.node,e.order)),[e]);}finally{ws.dispose();reload.dispose();}
  }
 }
 // 分支必須根據結算回報，不能把600預定傷害當成600實際扣血／回血。
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  for(const [lost,healed,expected] of [[600,600,0],[269,269,1],[600,0,1],[270,270,0]]){
   let branches=0;const self:any={id:'S',battleId:'S',currentHp:500,maxHp:2000},opp:any={id:'E',battleId:'E',currentHp:2000,maxHp:2000};
   const ctx:any={actor:side,targetSide:other,self,target:opp,getFullTeam:(s:string)=>[s===side?self:opp],applyPinkDamage:(s:string,n:number,_a:any,_b:any,_c:any,kind:string,o:any)=>{assert.equal(s,other);assert.equal(n,600);assert.equal(kind,'fixed');o.onSettled({targetBattleId:'E',settledAmount:600,hpLost:lost});},applyHealToElf:(s:string,id:string,n:number,o:any)=>{assert.equal(s,side);assert.equal(n,600);o.onSettled({targetBattleId:id,hpGained:healed});}};
   settlementChainOperations({runStmts:()=>{branches++;},addTimer:()=>{}}).drain_checked_then(ctx,{type:'固定',flat:600,threshold:270,measure:'either',belowBody:[{acts:[]}]},{last:null,lastAmount:0});
   assert.equal(branches,expected);
  }
  const [high]=await h.play(side,{self:h.unit('S',1000,[abyss],{maxHp:3000,speed:200}),opp:h.unit('E',2000,[{...h.wait(),pp:5},{...h.wait(),pp:8},{...h.wait(),pp:8}],{maxHp:3000})});
  assert.equal(high.opp.currentHp,1400,high.logs.join('\n'));
  assert.equal(high.self.currentHp,1600);
  assert.deepEqual(high.opp.skills.map((s:any)=>s.pp),[4,0,0],'最高PP並列槽同時清空，其他槽保留');
  const [low]=await h.play(side,{self:h.unit('S',1000,[abyss],{maxHp:3000,speed:200}),opp:h.unit('E',1400,[h.wait()],{maxHp:3000})});
  assert.equal(low.opp.currentHp,1100,low.logs.join('\n'));
  assert.equal(low.self.currentHp,1300);
  const [full]=await h.play(side,{self:h.unit('S',3000,[abyss],{speed:200}),opp:h.unit('E',3000,[h.wait()])});
  assert.ok(h.statuses(full.opp).includes('害怕'),full.logs.join('\n'));
  const [blocked]=await h.play(side,{self:h.unit('S',3000,[abyss],{speed:200}),opp:h.unit('E',3000,[{...h.turnEffectSkill(),priority:10}]),oppBench:[h.unit('B1',2000,[h.wait()]),h.unit('B2',2000,[h.wait()]),h.unit('Extra',2000,[h.wait()],{extra:{isExtra:true}})]});
  assert.ok(!h.statuses(blocked.opp).includes('害怕'));
  const benchTeam=blocked.state[`${other}Team`];
  assert.equal(benchTeam.find((e:any)=>e.id==='B1').currentHp,1700,blocked.logs.join('\n'));
  assert.equal(benchTeam.find((e:any)=>e.id==='B2').currentHp,1700);
  assert.equal(benchTeam.find((e:any)=>e.id==='Extra').currentHp,2000,'場下精靈選取維持既有額外精靈排除規則');
  const [reverse]=await h.play(side,{self:h.unit('S',3000,[shadow],{statStages:{atk:-2},speed:200}),opp:h.unit('E',20000,[h.wait()],{statStages:{spatk:2}})});
  assert.equal(reverse.self.statStages.atk,2,reverse.logs.join('\n'));
  assert.equal(reverse.self.statStages.spatk,2);
  assert.equal(reverse.opp.skills[0].pp,0);
  assert.equal(reverse.opp.statStages.spatk,0);
  const [inscribed]=await h.play(side,{self:h.unit('S',2000,[inscription],{maxHp:5000,speed:200,statStages:{atk:1}}),opp:h.unit('E',3000,[h.wait()])});
  assert.equal(inscribed.self.statStages.spatk,2);
  assert.equal(inscribed.self.currentHp,4000,'低於半血時按對手最大體力2/3吸取');
  assert.equal(inscribed.opp.currentHp,400,'百分比2000加神秘系技能600分開結算');
  const [newBoost]=await h.play(side,{self:h.unit('S',2000,[inscription],{maxHp:5000,speed:200}),opp:h.unit('E',3000,[h.wait()])});
  assert.equal(newBoost.opp.currentHp,400,'銘刻前段剛取得的強化，後段須即時讀到');
  for(const [mine,enemy,mult] of [[0,0,1.77],[3,-1,13.32],[-2,-1,7.16]]){
   const attack=h.kitSkill('直接技能100',[{op:'dmg',p:{flat:100,type:'技能',elem:'普通'}}],{priority:mine});
   const [hit]=await h.play(side,{self:h.unit('S',3000,[attack],{extra:{soulMark:{name:'倍率測試',effectMode:'kit',description:'',kit:damageKit}}}),opp:h.unit('E',100000,[{...h.wait(),priority:enemy}])});
   assert.equal(hit.opp.currentHp,100000-Math.floor(100*mult),hit.logs.join('\n'));
  }
  const [noTurn]=await h.play(side,{self:h.unit('S',1000,[fifth],{maxHp:3000,speed:200}),opp:h.unit('E',30000,[h.wait()])});
  assert.ok(h.statuses(noTurn.opp).includes('害怕'),noTurn.logs.join('\n'));
  for(const locked of [false,true]){
   const buff=h.kitSkill('對手回合效果',[{op:'prio_turns',p:{v:1,turns:4}}],{priority:10});
   const [cleared]=await h.play(side,{self:h.unit('S',1000,[fifth],{maxHp:3000}),opp:h.unit('E',30000,[buff],{extra:{ownTurnEffectsUnclearable:locked}})});
   assert.equal(cleared.self.currentHp,3000,cleared.logs.join('\n'));
   assert.ok(h.statuses(cleared.opp).includes(locked?'束縛':'沉默'),cleared.logs.join('\n'));
  }
  const duration=await h.play(side,{self:h.unit('S',1000,[abyss,{...h.wait(),pp:99}],{maxHp:10000,speed:200}),opp:h.unit('E',100000,[h.wait(),{...h.wait(),pp:90}]),turns:(_e:any,t:number)=>[t===1?0:1,1]},6);
  assert.deepEqual(duration.map((r:any)=>r.opp.currentHp),[99400,98800,98200,97600,97000,97000],duration.at(-1).logs.join('\n'));
  console.log(`✓ ${side} 莫迪西斯先手／結界正式引擎與實際吸取分支`);
 }
}finally{await h.close();}
