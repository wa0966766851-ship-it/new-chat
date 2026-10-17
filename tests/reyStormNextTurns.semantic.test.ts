import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const skill=structuredClone(h.find('5029','異境神霆'));
// 僅隔離增傷／先制與保底；完整吸取時點由 reyStormMigration 覆蓋。
skill.kit=skill.kit.filter((e:any)=>e.order!==3);
try{
 for(const side of ['p1','p2'] as const){
  for(const first of [false,true]){
  const seen:string[]=[];
  h.S.S=(c:any,e:any,d:any)=>{
   if(e===T.BEFORE_ACTION){seen.push('S');if(c.roundNumber>1){c.applyPinkDamage(c.targetSide,100,'固定探針',undefined,undefined,'fixed');c.applyPinkDamage(c.targetSide,100,'百分比探針',undefined,undefined,'percent');c.applyTrueDamage(c.targetSide,100,'真實探針');}}
   if(e===T.BEFORE_DAMAGE&&!d?.damageComp?.isIncoming&&d.damageComp.damageCategory==='skill_attack'){d.damageComp.base=100;}
  };
  h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)seen.push('E');};
  try{
   const r=await h.play(side,{self:h.unit('S',1000000,[structuredClone(skill),{...h.wait(),category:'物理',power:1}],{maxHp:10000000,speed:first?200:90}),opp:h.unit('E',1000000,[h.wait(),{...h.wait(),priority:2}],{speed:first?100:200}),turns:(_,t)=>[t===1?0:1,first&&t===1?0:1]},4);
   assert.deepEqual(seen,[...(first?['S','E']:['E','S']),'S','E','S','E','E','S']);
   assert.equal(r[0].opp.currentHp,999700,'當次不套下回合增傷，主傷害僅保底300');
   assert.equal(r[0].opp.currentHp-r[1].opp.currentHp,1030,'第2回合固定/百分比/技能各310，真傷100');
   assert.equal(r[1].opp.currentHp-r[2].opp.currentHp,1030,'第3回合仍3.1倍非真實');
   assert.equal(r[2].opp.currentHp-r[3].opp.currentHp,400,'第4回合增傷及先制都到期');
   assert.equal(r[3].state[side+'RegistryState']['otherworldRey.priorityTurns']||0,0);
   checks++;console.log(`✓ ${side} ${first?'先手':'後手'}隔離窗口：當次不套、下兩回合先制+3/非真實+210%，第4回合到期，真傷不增幅`);
  }finally{delete h.S.S;delete h.S.E;}
  }
  const clear=h.kitSkill('清除自己回合效果',[{op:'clear_turn',p:{side:'self'}}]);
  for(const mode of ['switch','clear'] as const){const order:string[]=[];
   const observe=(name:string)=>(c:any,e:any,d:any)=>{if(e===T.BEFORE_ACTION)order.push(name);if(e===T.BEFORE_DAMAGE&&!d?.damageComp?.isIncoming&&d.damageComp.damageCategory==='skill_attack')d.damageComp.base=100;};
   h.S.S=observe('S');h.S.B=observe('B');h.S.E=observe('E');
   try{const r=await h.play(side,{self:h.unit('S',1000000,[structuredClone(skill),clear,{...h.wait(),category:'物理',power:1}],{maxHp:10000000,speed:90}),selfBench:[h.unit('B',1000000,[{...h.wait(),category:'物理',power:1}],{speed:90})],opp:h.unit('E',1000000,[{...h.wait(),priority:2}],{speed:200}),turns:(_,t)=>[t===1?0:t===2?(mode==='switch'?{switch:1}:1):2,0]},mode==='switch'?2:3);
    if(mode==='switch'){assert.equal(r[1].self.id,'B');assert.ok(!r[1].state[side+'Timers'].some((t:any)=>['next_priority_bonus','non_true_next_boost'].includes(t.id)));}
    else{assert.deepEqual(order,['E','S','S','E','E','S']);assert.equal(r[1].opp.currentHp-r[2].opp.currentHp,100);}
    checks++;console.log(`✓ ${side} ${mode==='switch'?'下場清除兩個窗口，替補不借用':'清除回合類效果同時取消增傷與先制'}`);
   }finally{delete h.S.S;delete h.S.B;delete h.S.E;}
  }
 }
 console.log(`異境神霆後續窗口 ${checks}項正式測試通過；全文持續吸取另由 reyStormMigration 驗證`);
}finally{await h.close();}
process.exit(0);
