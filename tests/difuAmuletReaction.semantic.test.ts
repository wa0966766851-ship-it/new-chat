import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try {
 const {DIFU_AMULET:item,DIFU_AMULET_ID:id}=await h.server.ssrLoadModule('/src/data/difuItem.ts');
 const {DIFU_READY_SOUL_KIT:soul}=await h.server.ssrLoadModule('/src/data/difuSoulKit.ts');
 const {DIFU_JUDGEMENT:judgement}=await h.server.ssrLoadModule('/src/data/difuSkills.ts');
 const {heldBattleItemProgramIssue}=await h.server.ssrLoadModule('/src/effects/battleItemProgram.ts');
 const {applyPowerProperties}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
 const {skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 assert.equal(heldBattleItemProgramIssue(item),null);
 const stageEntry=judgement.kit.find((e:any)=>e.params?.property==='stage_power');
 assert.equal(skillPropertyIssue(stageEntry),null);
 for(const [stages,want] of [[{},90],[{atk:2,def:1,spatk:-3},150],[{atk:6,def:6,spatk:6,spdef:6,speed:6,accuracy:6},810]] as const) {
  const ctx:any={self:{},target:{statStages:stages},getPlayerState:()=>undefined,getOpponentState:()=>undefined};
  assert.equal(applyPowerProperties(judgement,ctx).power,want);
  assert.equal(judgement.power,90,'公式前加值不寫穿技能面板');
 }
 const source=(name:string,skills:any[],spatk=1000)=>h.unit(name,10000,skills,{maxHp:20000,speed:200,
  extra:{calculatedStats:{hp:20000,atk:300,def:300,spatk,spdef:300,speed:200},soulMark:{name:'護符開戰',effectMode:'kit',kit:[soul[0]]}}});
 for(const side of ['p1','p2'] as const) {
  for(const type of ['固定','百分比','真實']) {
   const hit=h.kitSkill('指定受傷',[{op:'dmg',p:{flat:100,type}}]);
   const [r]=await h.play(side,{self:source('holder',[h.wait()]),opp:h.unit('enemy',10000,[hit])});
   const expected=type==='真實'?910:460;
   assert.equal(r.opp.currentHp,10000-expected,JSON.stringify({side,type,logs:r.logs}));
   assert.equal(r.self.currentHp,9900+expected);
  }
  const hit=h.kitSkill('啟動一次受傷',[{op:'dmg',p:{flat:100,type:'真實'}}]);
  const [both]=await h.play(side,{self:source('own',[h.wait()]),opp:source('other',[hit])});
  assert.equal(both.self.currentHp,10810,'最初受傷100，獨立91次各回復10');
  assert.equal(both.opp.currentHp,9090,'反應造成910真傷，但不引發敵方護符繼續反應');
  assert.equal(both.state[side+'ItemInventory'][id].left,1);
  const fixed=h.kitSkill('普通受傷',[{op:'dmg',p:{flat:100,type:'固定'}}]);
  const [fixedBoth]=await h.play(side,{self:source('own',[h.wait()]),opp:source('other',[fixed])});
  assert.equal(fixedBoth.self.currentHp,10360);
  assert.equal(fixedBoth.opp.currentHp,9540,'固定吸取亦不再引發第二層反應');
 }
 console.log('difuAmuletReaction passed: actual catalog, three damage types, P1/P2 mutual reaction stop and punishment');
} finally {await h.close();}
