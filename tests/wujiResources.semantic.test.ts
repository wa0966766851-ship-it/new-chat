import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
  const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {isZeroPpExempt}=await h.server.ssrLoadModule('/src/battle/ppExemptions.ts');
  const {readMarkRemainingTurns}=await h.server.ssrLoadModule('/src/effects/markQueries.ts');
  const {validateKit}=await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
  const {MIGRATED_ARENA14_WUJI_SOUL_KIT:def}=await h.server.ssrLoadModule('/src/data/migratedArena14WujiSoulKit.ts');
  const owner=DEFAULT_ELVES.find((e:any)=>e.id==='arena_14');validateKit(def.kit);
  for(const side of ['p1','p2'] as const)for(const bad of [0,1,3]){
    const self=h.unit('S',100000,[h.wait()],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}});
    // 持有者自己的低機率特性不計；二代特質也不混入通用特性範圍。
    self.trait={name:'持有者自己的特性',description:'30%令對手害怕'};
    const benches=[0,1,2].map(i=>h.unit('B'+i,10000,[h.wait()],{extra:{
      trait:{name:'通用',description:i<bad?'30%令對手害怕':'沒有異常附加'},
      alienTraits:{gen2Trait:{name:'二代',description:'30%令對手害怕'}},
    }}));
    const expected=Math.max(0,3-bad*2),foe=side==='p1'?'p2':'p1';
    const history=await h.play(side,{self,selfBench:benches,opp:h.unit('E',100000,[h.wait()]),turns:(engine:any)=>{
      const st=engine.getState(),hero=st[`${side}Marks`].find((m:any)=>m.id==='arena.heroGlory');
      assert.equal(hero?.count||0,expected,'不含+1、含有-1，排除自身及二代特質');
      const wuzhu=st[`${foe}Marks`].find((m:any)=>m.id==='arena.wuzhu');
      assert.equal(wuzhu?.remainingRounds||0,expected,'登場武誅以自己的英雄層數設定正式期限');
      if(wuzhu){assert.equal(wuzhu.ownerBattleId,'E');assert.equal(wuzhu.effects.priorityBonus,-2);}
      const skill={...h.find('arena_14','鋭武銘戈'),pp:0};
      assert.equal(isZeroPpExempt(st[side],skill,st[foe]),expected>=3,'技能讀相同正式印記');
      return [0,0];
    }});
    if(expected){
      const st=history[0].state;
      const ctx={actor:foe,targetSide:side,self:st[foe],target:st[side],getMarks:(s:string)=>st[`${s}Marks`]};
      assert.equal(readMarkRemainingTurns(ctx,{side:'self',id:'arena.wuzhu'}),expected-1,'查詢正式遞減後期限而非初始層數');
    }
    console.log(`✓ ${side} 無極聖武 ${bad}名低機率特性隊員：英雄${expected}層、正式免PP／武誅歸屬與期限`);
  }
  const badKit=structuredClone(def.kit);
  badKit[0].params.clause.body[0].acts[0].p.traitSources=['unknown'];assert.throws(()=>validateKit(badKit));
  const badPriority=structuredClone(def.kit);badPriority.find((e:any)=>e.node==='on_entered').params.clause.body[0].acts[0].p.priorityBonus=99;assert.throws(()=>validateKit(badPriority));
  console.log('無極聖武開局資源6個正式P1/P2情境與非法參數拒絕；其他魂印條款仍須逐條驗收。');
}finally{await h.close();}
