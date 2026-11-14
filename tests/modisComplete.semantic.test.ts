import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {turnEffectPolarity} from '../src/battle/turnEffectPolarity';
const h=await createHarness();
try{
 const {MODIS_SEED:seed}=await h.server.ssrLoadModule('/src/data/modis.ts');
 const {DEFAULT_ELVES:elves}=await h.server.ssrLoadModule('/src/data/defaultElves.ts');
 const registered=elves.find((e:any)=>e.id==='5039');assert.ok(registered);
 assert.equal(registered.soulMark.description,seed.soulMark.description);
 assert.deepEqual(registered.soulMark.kit,seed.soulMark.kit);
 assert.deepEqual(registered.skills.map((s:any)=>[s.name,s.isFifthSkill]),seed.skills.map((s:any)=>[s.name,s.isFifthSkill]));
 const {applyFormulaProperties}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
 const {calculateDamage}=await h.server.ssrLoadModule('/src/utils/damageCalculator.ts');
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  const hit=h.kitSkill('技能100',[{op:'dmg',p:{type:'技能',flat:100,elem:'普通'}}]);
  const [first,second]=await h.play(side,{self:h.unit('S',10000,[hit,h.wait()],{maxHp:20000,speed:200,extra:{soulMark:seed.soulMark}}),opp:h.unit('E',100000,[h.wait()])},2);
  assert.equal(first.self.statStages.spatk,3,first.logs.join('\n'));
  assert.equal(first.self.statStages.accuracy,1);
  assert.equal(first.self.statStages.atk??0,0,'魂印先手不能偷加攻擊');
  assert.equal(first.state[`${side}RegistryState`].lastSkillDamageDealtRound,1,'正式結算記錄造成技能傷害');
  assert.equal(second.state[`${side}RegistryState`].previousSkillDamageAbsent,false,'前回合實際造成技能傷害則本回合不啟動1/3吸取');
  assert.equal(second.self.statStages.spatk,6);
  const fixed=h.kitSkill('固定100',[{op:'dmg',p:{type:'固定',flat:100}}]);
  const fixedHistory=await h.play(side,{self:h.unit('S',20000,[fixed],{extra:{soulMark:seed.soulMark}}),opp:h.unit('E',100000,[h.wait()])},2);
  assert.equal(fixedHistory[1].state[`${side}RegistryState`].previousSkillDamageAbsent,true,'固定與百分比吸取不能誤記為技能傷害');
  // 對手先使用技能：全屬性-1，另降雙攻／特防／速度-1，防禦及命中不得多降。
  const fast=h.kitSkill('對手快招',[{op:'heal_flat',p:{amount:1}}],{priority:10});
  const [opFirst]=await h.play(side,{self:h.unit('S',20000,[h.wait()],{extra:{soulMark:seed.soulMark}}),opp:h.unit('E',100000,[fast,{...h.wait(),pp:1}])});
  assert.equal(opFirst.opp.statStages.atk,-2,opFirst.logs.join('\n'));
  assert.equal(opFirst.opp.statStages.def,-1);
  assert.equal(opFirst.opp.statStages.accuracy,-1);
  assert.equal(opFirst.opp.skills[1].pp,0,'同位置PP確實吸至0');
  assert.ok(opFirst.state[`${other}Timers`].some((t:any)=>t.payload?.statusInflictGuard),'PP0分支限制對手附加異常');
  // 獨立使用共用消正面積木：負面效果留下，不借用顯示文字。
  const buff=h.kitSkill('免疫與禁療',[
   {op:'immune_status_turns',p:{turns:4,cls:'非附屬類',reflect:false}},
   {op:'recovery_reduce_turns',p:{side:'self',ratio:1,turns:4,includePotions:true}},
  ],{priority:10});
  const clear=h.kitSkill('只消正面',[{op:'clear_turn',p:{side:'opp',polarity:'positive'}}]);
  const [filtered]=await h.play(side,{self:h.unit('S',10000,[clear]),opp:h.unit('E',10000,[buff])});
  const timers=filtered.state[`${other}Timers`];
  assert.ok(!timers.some((t:any)=>t.payload?.block?.statusGuard),filtered.logs.join('\n'));
  assert.ok(timers.some((t:any)=>turnEffectPolarity(t)==='negative'),'禁療負面效果不能被清掉');
  // 0/16基礎致命率只改本招，不改持有者面板；明確致命覆寫仍可生效。
  const actor=h.unit('A',10000,[],{extra:{critValue:16}}),target=h.unit('B',10000,[]);
  const slash=seed.skills[3];
  const formula=applyFormulaProperties(slash,{actor:side,targetSide:other,self:actor,target,getPlayerState:()=>0,getOpponentState:()=>0});
  assert.equal(formula.resolvedBaseCritChance,0);
  assert.equal(calculateDamage(actor,target,formula,side,undefined,undefined,1).isCrit,false);
  assert.equal(calculateDamage(actor,target,formula,side,undefined,undefined,1,true).isCrit,true);
  assert.equal(actor.critValue,16);
  const [lastSlash]=await h.play(side,{self:h.unit('S',10000,[slash],{speed:200}),opp:h.unit('E',100000,[h.wait()])});
  assert.ok(lastSlash.logs.some((s:string)=>s.includes('必中致命一擊')),lastSlash.logs.join('\n'));
  assert.ok(h.statuses(lastSlash.opp).includes('臣服'));
  assert.ok(h.statuses(lastSlash.opp).includes('疲憊'));
  const seal=h.kitSkill('封鎖攻擊',[{op:'invalid_next',p:{kind:'攻擊',uses:1}}],{priority:10});
  const [invalid]=await h.play(side,{self:h.unit('S',10000,[slash]),opp:h.unit('E',100000,[seal])});
  assert.ok(h.statuses(invalid.opp).includes('沉默'),invalid.logs.join('\n'));
  assert.ok(h.statuses(invalid.opp).includes('害怕'));
  console.log(`✓ ${side} 莫迪西斯完整魂印、前回合事實、PP分支、正面過濾及固有致命率`);
 }
}finally{await h.close();}
