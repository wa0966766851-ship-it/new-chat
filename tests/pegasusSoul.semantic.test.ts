import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {PEGASUS_SOUL_KIT:kit}=await h.server.ssrLoadModule('/src/data/pegasusSoulKit.ts');
 const {authoredEntry:e,operation:a,actions:act}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 const {PEGASUS_PHASE_KEY:key,PEGASUS_READY_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/pegasusSkills.ts');
 const soul=(entries:any[])=>({name:'羽毛驗證',effectMode:'kit',kit:entries});
 const hit={...h.wait(),name:'大攻擊',category:'物理',power:1000,priority:0,accuracy:100};
 for(const side of ['p1','p2'] as const){
  const blue=kit.filter((x:any)=>x.order===0||x.customText.startsWith('藍色羽毛:'));
  const change=h.kitSkill('能力變化',[a('stat',{side:'self',stats:['攻擊'],v:1})]);
  const rows=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{soulMark:soul(blue)}}),opp:h.unit('E',100000,[change,hit]),turns:(_e:any,t:number)=>[0,t===1?0:1]},3);
  assert.equal(rows[0].state[side+'RegistryState'].featherBlockPending,true,'對手實際能力變化準備抵擋');
  assert.equal(rows[1].self.currentHp,100000,'第一次攻擊被抵擋');
  assert.ok(rows[1].opp.currentHp<100000,'抵擋量結算真實反傷');
  assert.equal(rows[2].self.currentHp,99720,'成功抵擋後恢復280非真實上限');
  const unchanged=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{soulMark:soul(blue)}}),opp:h.unit('E',100000,[change,hit],{statStages:{atk:6}}),turns:(_e:any,t:number)=>[0,t===1?0:1]},2);
  assert.equal(unchanged[0].state[side+'RegistryState'].featherBlockPending,false,'能力封頂未改變時不能準備抵擋');
  assert.equal(unchanged[1].self.currentHp,99720,'未發生變化仍採280上限');
  const lifecycle=kit.filter((x:any)=>x.order<4);
  const fatal=h.kitSkill('致死',[a('dmg',{flat:200000,type:'真實'})]);
  const phases=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul(lifecycle)}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',100000,[fatal,h.wait()]),turns:(_e:any,t:number)=>t===5?[{switch:1},1]:[0,t===1?0:1]},5);
  assert.equal(phases[0].self.combatPhases[key].phase,'potential');assert.equal(phases[0].self.currentHp,16000);
  assert.equal(phases[3].self.combatPhases[key].phase,'spent');assert.equal(phases[3].self.calculatedStats.spatk,120);assert.ok(h.statuses(phases[3].self).includes('眩暈'));
  assert.equal(phases[4].state[side+'Team'][0].calculatedStats.spatk,300);
  // 最終威力必須在白羽／第五技的隨機威力取值後乘算。
  for(const enhanced of [false,true]){
   const entry=e('測試階段','entrance',[act(a('phase_enter',{key,name:enhanced?'potential':'normal'}))],0,'soulmark');
   const golden=kit.filter((x:any)=>x.customText.startsWith('金色羽毛:')&&x.params.clause.trig==='outgoing_power');
   const sk=structuredClone(skills[2]);sk.kit=sk.kit.filter((x:any)=>x.params.clause?.trig==='outgoing_power');
   const [plain]=await h.play(side,{self:h.unit('S',100000,[sk]),opp:h.unit('E',100000,[h.wait()])});
   const [boosted]=await h.play(side,{self:h.unit('S',100000,[sk],{extra:{soulMark:soul([entry,...golden])}}),opp:h.unit('E',100000,[h.wait()])});
   const base=100000-plain.opp.currentHp,actual=100000-boosted.opp.currentHp,mult=enhanced?10:2;
   assert.ok(Math.abs(actual/base-mult)<.1,`最終威力×${mult}：${base}→${actual}`);
  }
  const goldType=kit.filter((x:any)=>x.customText.startsWith('金色羽毛:')&&x.params.clause.trig==='before_skill');
  const carried={...h.wait(),name:'攜帶水系',type:'水'};
  const strike={...hit,name:'普通攻擊',power:100,type:'普通'};
  const [ordinary]=await h.play(side,{self:h.unit('S',100000,[strike,carried],{type:'草'}),opp:h.unit('E',100000,[h.wait()],{type:'火'})});
  const [best]=await h.play(side,{self:h.unit('S',100000,[strike,carried],{type:'草',extra:{soulMark:soul([kit[0],...goldType])}}),opp:h.unit('E',100000,[h.wait()],{type:'火'})});
  assert.ok((100000-best.opp.currentHp)/(100000-ordinary.opp.currentHp)>2.8,`攜帶技能水系最優屬性並獲本系加成：${100000-ordinary.opp.currentHp}→${100000-best.opp.currentHp} ${JSON.stringify(best.state[side+'RegistryState'])}`);
  const purple=kit.filter((x:any)=>x.order===0||x.customText.startsWith('紫色羽毛:'));
  const [capped]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{statStages:{atk:6},extra:{soulMark:soul(purple)}}),opp:h.unit('E',100000,[h.wait()])});
  assert.ok(h.statuses(capped.opp).includes('害怕'),'任一項能力未完整觸發即執行補償');
  // 潛能的零PP與強制命中走正式選招／失效路徑，不能靠描述文字。
  const potentialEntry=e('測試潛能','entrance',[act(a('phase_enter',{key,name:'potential'}))],0,'soulmark');
  const [unblocked]=await h.play(side,{self:h.unit('S',100000,[h.wait()]),opp:h.unit('E',100000,[hit])});
  const [potentialBlue]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{extra:{soulMark:soul([potentialEntry,...blue.filter((x:any)=>x.order!==0)])}}),opp:h.unit('E',100000,[hit])});
  assert.equal(potentialBlue.self.currentHp,100000,'潛能取消能力變化條件，直接抵擋攻擊');
  assert.equal(100000-potentialBlue.opp.currentHp,100000-unblocked.self.currentHp,'潛能藍羽按原文反傷抵擋量100%');
  const goldRecovery=kit.filter((x:any)=>x.customText.startsWith('金色羽毛:')&&x.params.clause.trig==='self_attack');
  const clearAndHeal=h.kitSkill('斷自身回合並回血',[a('clear_turn',{side:'self'}),a('heal_flat',{amount:300})]);
  const healing=await h.play(side,{self:h.unit('S',100000,[strike,h.wait()],{speed:300,extra:{soulMark:soul([potentialEntry,...goldRecovery])}}),opp:h.unit('E',50000,[h.healSkill(300),clearAndHeal],{maxHp:100000}),turns:(_e:any,t:number)=>t===1?[0,0]:[1,1]},2);
  const enemySide=side==='p1'?'p2':'p1',reduction=healing[0].state[enemySide+'Timers'].find((t:any)=>t.payload?.recoveryReductionPercent===1);
  assert.equal(reduction.kind,'turn_effect','魂印明文綁定對手的回合類效果');assert.equal(reduction.source,'soulmark','保留實際魂印來源');
  assert.equal(healing[1].opp.currentHp-healing[0].opp.currentHp,300,'被斷回合後可正常回血');
  const zero=structuredClone(skills[0]);zero.pp=0;zero.currentPp=0;
  const [forced]=await h.play(side,{self:h.unit('S',100000,[zero],{extra:{isAdditionalInvalid:true,soulMark:soul([potentialEntry])}}),opp:h.unit('E',100000,[h.wait()])});
  assert.ok(forced.opp.currentHp<100000,'零PP仍可出招，附加失效時仍強制執行命中效果');
  assert.ok(h.statuses(forced.opp).includes('冰封'),'強制執行凍傷後轉化冰封');
  assert.equal(forced.self.skills[0].pp,0,'零PP不變成負數');
 }
 console.log('pegasusSoul passed: P1/P2 actual stage event, one-use block/reflection, cap restoration, rebirth/expiry/switch and final power ×2/×10');
}finally{await h.close();}
