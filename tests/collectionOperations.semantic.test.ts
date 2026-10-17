import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const select=(body:any[],extra:any={})=>({op:'select_elf',p:{side:'opp',scope:'team',state:'any',orderBy:'max_hp',direction:'asc',body,...extra}});
const change=(ratio=1)=>select([{acts:[{op:'raise_max_hp',p:{source:'self',ratio}},{op:'heal_selected_then',p:{ratio:1,body:[{acts:[{op:'stat_points',p:{stats:['atk','def','spatk','spdef','speed'],direction:'decrease',ratio:1,cap:100,floor:1}}]}]}}]}]);
const clause=(a:any)=>h.kitSkill('合約',[a]).kit[0].params.clause;
try{
  await check('嚴格集合子流程合約，綁定葉不能在外執行，不接受失去目標或未知能力',()=>{
    assert.equal(sequenceIssue(clause(change())),null);
    for(const a of [change().p.body[0].acts[0],{op:'vanish_selected',p:{}},select([{acts:[{op:'heal_flat',p:{amount:5}}]}]),select([{acts:[{op:'stat_points',p:{stats:['hp'],direction:'decrease',ratio:1,cap:100,floor:1}}]}]),select([{acts:[{op:'vanish_selected',p:{extra:1}}]}]),select([{acts:[{op:'vanish_selected',p:{}}]}],{side:'both'})])assert.ok(sequenceIssue(clause(a)));
    assert.ok(sequenceIssue(clause({op:'next_entry_priority',p:{turns:1}})));
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 最低上限只改所選場下；上限／正式恢復／五項能力依實際提升50且下限1`,async()=>{
      const b=h.unit('B',500,[h.wait()],{maxHp:1000});b.calculatedStats={hp:1000,atk:20,def:60,spatk:300,spdef:300,speed:300};
      const [r]=await h.play(side,{self:h.unit('S',1050,[h.kitSkill('集合',[change()])]),opp:h.unit('E',5000,[h.wait()]),oppBench:[b]});
      const e=r.state[`${other}Team`][1];assert.equal(e.maxHp,1050);assert.equal(e.calculatedStats.hp,1050);assert.equal(e.currentHp,550);assert.deepEqual([e.calculatedStats.atk,e.calculatedStats.def,e.calculatedStats.spatk,e.calculatedStats.spdef,e.calculatedStats.speed],[1,10,250,250,250]);assert.equal(r.opp.currentHp,5000);assert.equal(r.opp.calculatedStats.atk,300);
    });
    await check(`${side} 同上限依背包先後選在場，能力扣上限100；不降低已較高上限`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',2000,[h.kitSkill('集合',[change()])]),opp:h.unit('E',500,[h.wait()],{maxHp:1000}),oppBench:[h.unit('B',500,[h.wait()],{maxHp:1000})]});assert.equal(r.opp.maxHp,2000);assert.equal(r.opp.currentHp,1500);assert.equal(r.opp.calculatedStats.atk,200);assert.equal(r.state[`${other}Team`][1].maxHp,1000);
      const [none]=await h.play(side,{self:h.unit('S',900,[h.kitSkill('集合',[change()])]),opp:h.unit('E',500,[h.wait()],{maxHp:1000})});assert.equal(none.opp.maxHp,1000);assert.equal(none.opp.currentHp,500);assert.equal(none.opp.calculatedStats.atk,300);
    });
    await check(`${side} 全隊any包含陣亡但恢復不復活；消逝與額外精靈排除`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',1050,[h.kitSkill('集合',[change()])]),opp:h.unit('E',5000,[h.wait()]),oppBench:[h.unit('V',0,[h.wait()],{maxHp:10,extra:{isVanished:true}}),h.unit('X',1,[h.wait()],{maxHp:20,extra:{isExtra:true}}),h.unit('D',0,[h.wait()],{maxHp:1000})]});const team=r.state[`${other}Team`];assert.equal(team[1].maxHp,10);assert.equal(team[2].maxHp,20);assert.equal(team[3].maxHp,1050);assert.equal(team[3].currentHp,0);assert.equal(team[3].calculatedStats.atk,250);
    });
    await check(`${side} 同elf.id不同battleId仍精確綁所選者；禁療只攔恢復、不改能力扣除基數`,async()=>{
      const b=h.unit('E',500,[h.wait()],{maxHp:1000,extra:{battleId:'B'}});
      const ban=h.kitSkill('先禁療',[{op:'no_heal',p:{turns:2,next:false}}],{priority:5});
      const hist=await h.play(side,{self:h.unit('S',2000,[ban,h.kitSkill('集合',[change()])]),opp:h.unit('E',500,[h.wait()],{maxHp:1000}),oppBench:[b],turns:(_,t)=>[t===1?0:1,0]},2);const r=hist[1];assert.equal(r.opp.maxHp,2000);assert.equal(r.opp.currentHp,500);assert.equal(r.opp.calculatedStats.atk,200);assert.equal(r.state[`${other}Team`][1].maxHp,1000);
    });
    await check(`${side} 只複製本次實際反轉下降，不借原提升；失敗不帶前次反轉結果`,async()=>{
      const s=h.kitSkill('反轉附加',[{op:'stat_reverse',p:{side:'self',kind:'down'}},{op:'stat_apply_last',p:{side:'opp',direction:'opposite'}},{op:'stat_reverse',p:{side:'self',kind:'down'}},{op:'stat_apply_last',p:{side:'opp',direction:'opposite'}}]);
      const [r]=await h.play(side,{self:h.unit('S',10000,[s],{statStages:{atk:-2,def:3,spdef:-1}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.self.statStages.atk,2);assert.equal(r.self.statStages.def,3);assert.equal(r.opp.statStages.atk,-2);assert.equal(r.opp.statStages.spdef,-1);assert.equal(r.opp.statStages.def||0,0);
    });
    await check(`${side} 消逝場下同elf.id的陣亡副本，只依battleId改目標而不誤消在場`,async()=>{
      const s=h.kitSkill('消逝集合',[select([{acts:[{op:'vanish_selected',p:{}}]}],{scope:'bench',state:'dead',orderBy:'team_order'})]);
      const [r]=await h.play(side,{self:h.unit('S',10000,[s]),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('E',0,[h.wait()],{maxHp:10000,extra:{battleId:'D'}})]});assert.ok(!r.opp.isVanished);assert.equal(r.state[`${other}Team`][1].isVanished,true);
    });
  }
  console.log(`集合數值與反轉結算：${checks}項通過`);
}finally{await h.close();}
