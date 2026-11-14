import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try {
 const {DIFU_SOUL_KIT:soul}=await h.server.ssrLoadModule('/src/data/difuSoulKit.ts');
 const {DIFU_JUDGEMENT}=await h.server.ssrLoadModule('/src/data/difuSkills.ts');
 const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 const {authoredEntry:e,actions:act,operation:a}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 const selection=soul.filter((k:any)=>k.params.clause.trig==='before_round_start');
 const after=soul.filter((k:any)=>['team_opponent_damage_settled','self_after_use','opp_after_skill'].includes(k.params.clause.trig));
 const immune=e('控制免疫','entrance',[act(a('immune_status_turns',{turns:5,cls:'控制類',reflect:false}))],0,'soulmark');
 for(const side of ['p1','p2'] as const) {
  for(const attack of [false,true]) {
   const own=h.unit('source',50000,[attack?{...h.wait(),name:'物理測試',category:'物理',power:1}:h.wait()],{speed:200,extra:{soulMark:{name:'選擇攻擊',effectMode:'kit',kit:selection}}});
   const [r]=await h.play(side,{self:own,opp:h.unit('enemy',300000,[h.wait()])});
   assert.equal((getStatuses(r.opp).害怕??0)>0,attack,'首回合雙方已選定後、先於行動控制附加害怕');
   assert.equal((getStatuses(r.opp).流血??0)>0,attack);
  }
  const [failed]=await h.play(side,{
   self:h.unit('source',50000,[{...h.wait(),category:'特殊',power:1}],{speed:200,extra:{battleStatuses:{中毒:3},effects:[{id:'中毒',name:'中毒',duration:3,stacks:1}],soulMark:{name:'選擇攻擊',effectMode:'kit',kit:selection}}}),
   opp:h.unit('enemy',300000,[h.wait()],{extra:{soulMark:{name:'控制免疫',effectMode:'kit',kit:[immune]}}}),
  });
  assert.equal(getStatuses(failed.opp).害怕??0,0);assert.ok((getStatuses(failed.opp).流血??0)>0,'其中一項成功也保留成功者');
  assert.equal(getStatuses(failed.self).中毒??0,0,'任一項失敗就解除自身異常');
  assert.ok(failed.state[(side==='p1'?'p2':'p1')+'Timers'].some((t:any)=>t.payload?.block?.prio===-3),'補償先制在本回合排序前生效');
  for(const [type,amount,expected,regret] of [['固定',1000,100000,true],['百分比',25000,100000,true],['真實',1000,100000,false],['固定',30000,0,false]] as const) {
   const hit=h.kitSkill('實際傷害',[{op:'dmg',p:{type,flat:amount}}]);
   const [r]=await h.play(side,{
    self:h.unit('source',50000,[h.wait()],{speed:200,extra:{soulMark:{name:'節點前傷害紀錄',effectMode:'kit',kit:after}}}),
    opp:h.unit('enemy',300000,[hit]),
   });
   assert.equal(r.opp.currentHp,expected,JSON.stringify({side,type,amount,logs:r.logs,reg:r.state[side+'RegistryState']}));
   if(expected>0)assert.equal((getStatuses(r.opp).神悔??0)>0,regret,'真實傷害不混入先前非真實傷害紀錄');
  }
  // 裁決的神悔失敗只在消除成功後觸發逐次吸取；沒有回合效果時不誤觸。
  for(const hasTurn of [false,true]) {
   const setup=e('可消除的先制效果','entrance',[act(a('prio_turns',{v:1,turns:5,next:false}))],1);
   const fixture=(judgement:any)=>({
    self:h.unit('source',50000,[judgement],{speed:200}),
    opp:h.unit('enemy',300000,[h.wait()],{extra:{soulMark:{name:'免疫與消除目標',effectMode:'kit',kit:[immune,...(hasTurn?[setup]:[])]},battleStatuses:{平靜:1},effects:[{id:'平靜',name:'平靜',duration:1,stacks:1}]}}),
   });
   const [r]=await h.play(side,fixture(DIFU_JUDGEMENT));
   const clearOnly=structuredClone(DIFU_JUDGEMENT);
   clearOnly.kit.find((k:any)=>k.params?.clause?.trig==='use').params.clause.body.splice(1);
   const [baseline]=await h.play(side,fixture(clearOnly));
   assert.equal(DIFU_JUDGEMENT.effectMode,'kit');
   assert.equal(baseline.opp.currentHp-r.opp.currentHp,hasTurn?48000:0,JSON.stringify({hasTurn,side,logs:r.logs}));
   assert.equal(getStatuses(r.opp).神悔??0,0,'消除技能回合效果不會消除魂印的控制免疫');
  }
 }
 console.log('difuComplete passed: first-round selection, partial failure, opponent damage history and both after-use nodes');
} finally {await h.close();}
