import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_FLAME_LIFECYCLE_KIT as kit,IMMORTAL_FLAME_KIND,IMMORTAL_FLAME_SAVED} from '../src/data/immortalAinsFlameKit';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const flame=(hist:any,side:string)=>hist.state[`${side}Team`].find((e:any)=>e.extraKind===IMMORTAL_FLAME_KIND);
const soul=(entries=kit)=>({name:'神焰生命週期',description:'已核對片段驗證',effectMode:'kit',effectType:'custom',kit:structuredClone(entries)});
const lethal=h.kitSkill('致死固定',[{op:'dmg',p:{flat:20000,type:'固定'}}]);
const stages={atk:2,def:-1};
try{
 defineCustomBlocks();
 for(const entry of kit){
  assert.equal(sequenceIssue(entry.params.clause,entry.node),null,entry.customText);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{buildEntryBlock(w as any,entry);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('soulmark')(r.getTopBlocks(false)[0],entry.node,entry.order),entry);}finally{w.dispose();r.dispose();}
 }
 for(const side of ['p1','p2'] as const){
  const owner=(extra:any={})=>h.unit('S',10000,[h.wait()],{speed:200,statStages:{...stages},extra:{soulMark:soul(),...extra}});
  const enemy=(skills:any[]= [lethal])=>h.unit('E',100000,skills,{speed:100,statStages:{...stages}});
  const result=await h.play(side,{self:owner(),opp:enemy()},1);
  assert.equal(result[0].self.currentHp,1,result[0].logs.join('\n'));
  assert.ok(flame(result[0],side)?.isVanished,'保命成功且無指定異常時，階段末犧牲神焰');
  assert.equal(result[0].self.statStages.atk,0);assert.equal(result[0].opp.statStages.atk,0);
  assert.equal(result[0].self.statStages.def,-1,'只清提升，不清下降');
  assert.equal(result[0].opp.statStages.def,-1);
  const shieldOwner=owner();shieldOwner.skills=[h.turnEffectSkill(),h.wait()];
  const timers=await h.play(side,{self:shieldOwner,opp:enemy([h.turnEffectSkill(),lethal]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
  const other=side==='p1'?'p2':'p1';
  assert.ok(timers[0].state[`${side}Timers`].some((t:any)=>t.kind==='turn_effect'));
  assert.ok(timers[0].state[`${other}Timers`].some((t:any)=>t.kind==='turn_effect'));
  assert.ok(!timers[1].state[`${side}Timers`].some((t:any)=>t.kind==='turn_effect'),'犧牲時清己方回合類效果');
  assert.ok(!timers[1].state[`${other}Timers`].some((t:any)=>t.kind==='turn_effect'),'犧牲時清對方回合類效果');
  const idle=await h.play(side,{self:owner(),opp:enemy([h.wait()])},1);
  assert.ok(!flame(idle[0],side)?.isVanished,'未保命不自行犧牲');
  for(const status of ['燒傷','焚燼','易燃']){
   const stay=await h.play(side,{self:owner({battleStatuses:{[status]:3}}),opp:enemy()},1);
   assert.ok(!flame(stay[0],side)?.isVanished,status+'阻止本回合犧牲');
   assert.equal(stay[0].self.currentHp,1,status+'下仍可保命');
  }
  // 易燃不自行扣血；同一神焰應能跨回合再次保命，而不是偷套「每場僅一次」。
  const repeatedOwner=owner();repeatedOwner.skills=[h.kitSkill('五回合易燃',[{op:'status',p:{side:'self',status:'易燃',turns:5,chance:100}}])];
  const repeats=await h.play(side,{self:repeatedOwner,opp:enemy()},2);
  assert.deepEqual(repeats.map(r=>r.self.currentHp),[1,1]);assert.ok(!flame(repeats[1],side)?.isVanished,JSON.stringify({status:h.statuses(repeats[1].self),logs:repeats[1].logs}));
  const buff=h.kitSkill('重新雙方強化',[{op:'stat',p:{side:'both',stats:['攻擊'],v:2}}]);
  const died=await h.play(side,{self:owner(),opp:enemy([lethal,buff]),selfBench:[h.unit('B',10000,[h.wait()])],turns:(_e,t)=>[0,t===2?1:0]},3);
  assert.equal(died[1].self.statStages.atk,2,'犧牲後重新加強可用');
  assert.equal(died[2].self.currentHp,0,'神焰犧牲後不再保命');
  assert.equal(died[2].self.statStages.atk,0,'犧牲後原召喚者真正死亡再清提升');
  assert.equal(died[2].opp.statStages.atk,0);
  const burnDeath=h.kitSkill('強化後燒傷',[{op:'stat',p:{side:'both',stats:['攻擊'],v:2}},{op:'status',p:{side:'opp',status:'燒傷',turns:3,chance:100}}]);
  const endDeath=await h.play(side,{self:owner(),opp:enemy([lethal,burnDeath]),selfBench:[h.unit('B',10000,[h.wait()])],turns:(_e,t)=>[0,t===1?0:1]},2);
  assert.equal(endDeath[1].self.currentHp,0,'回合末燒傷也能真正擊敗已失去神焰的召喚者');
  assert.equal(endDeath[1].opp.statStages.atk,0,'死亡節點三不能漏掉犧牲後死亡清除');
  const teammate=await h.play(side,{self:owner(),opp:enemy([lethal,buff]),selfBench:[h.unit('B',10000,[h.wait()])],turns:(_e,t)=>[t===2?{switch:1}:0,t===2?1:0]},3);
  assert.equal(teammate[2].self.id,'B');assert.equal(teammate[2].self.currentHp,0);
  assert.equal(teammate[2].opp.statStages.atk,2,'隊友死亡不冒用原召喚者的犧牲後條款');
  const noOwn=owner({soulMark:soul(kit.filter(e=>e.node!=='battle_start'))});
  const otherSummoner=h.unit('B',10000,[h.wait()],{extra:{soulMark:soul(kit.filter(e=>e.node==='battle_start'))}});
  const borrowed=await h.play(side,{self:noOwn,opp:enemy(),selfBench:[otherSummoner]},1);
  assert.equal(borrowed[0].self.currentHp,0,'不能借隊友召喚的同名神焰保命');
  assert.equal(flame(borrowed[0],side)?.summonerId,'B');
  assert.ok(!flame(borrowed[0],side)?.isVanished);
  // 測試夾具只排入「本回合已保命」旗標；驗證正式背包事件能處理待結算的後排持有者。
  // 不把這個夾具當成「同一出手中強制換人」的端到端驗收。
  const queueSaved:any={codeId:'effect_sequence',source:'soulmark',role:'innate',node:'after_action',order:4,customText:'測試：排入待結算保命',
   params:{clause:{raw:'測試：排入待結算保命',trig:'team_after_action',parsed:true,body:[{acts:[{op:'flag_set',p:{key:IMMORTAL_FLAME_SAVED,value:true,thisRound:true},label:'排入待結算保命'}]}]}}};
  const waitingOwner=owner({soulMark:soul([...kit,queueSaved])});
  const queued=await h.play(side,{self:h.unit('B',10000,[h.wait()]),selfBench:[waitingOwner],opp:enemy([h.wait()])},1);
  assert.ok(flame(queued[0],side)?.isVanished,'後排持有者的待結算神焰仍須犧牲：'+JSON.stringify({logs:queued[0].logs,team:queued[0].state[`${side}Team`].map((e:any)=>({id:e.id,name:e.name,kind:e.extraKind,vanished:e.isVanished}))}));
  assert.equal(queued[0].self.id,'B');assert.equal(queued[0].self.currentHp,10000,'不把保命套到目前隊友');
  assert.equal(queued[0].state[`${side}Team`].find((e:any)=>e.id==='S').statStages.atk,0,'後排原持有者的提升被清除');
  assert.equal(queued[0].opp.statStages.atk,0);
  console.log(`✓ ${side} 神焰召喚、保命、三種異常閘控、重複保命、犧牲及其後死亡清除`);
 }
}finally{await h.close();}
