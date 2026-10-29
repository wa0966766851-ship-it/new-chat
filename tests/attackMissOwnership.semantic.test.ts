import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
try{
 const {computeHitChance}=await h.server.ssrLoadModule('/src/effects/genericSkillText.ts');
 const plain={...h.wait(),category:'物理',isSureHit:false,description:'',accuracy:100};
 const actor=h.unit('A',1000,[plain]),target=h.unit('B',1000,[plain]);
 assert.equal(computeHitChance(actor,target,plain,()=>({}),{}, {attackMissTurns:2}),0);
 assert.equal(computeHitChance(actor,target,{...plain,category:'屬性'},()=>({}),{}, {attackMissTurns:2}),1);
 assert.equal(computeHitChance(actor,target,{...plain,isSureHit:true},()=>({}),{}, {attackMissTurns:2}),1);
 assert.equal(computeHitChance(actor,target,plain,()=>({}),{attackMissTurns:2},{}),1);
 checks++;
 for(const side of ['p1','p2'] as const){
  const sk=h.find('5010','星光·浪打千擊'),attack={...plain,name:'普通攻擊',power:100};
  const r=await h.play(side,{self:h.unit('S',100000,[h.wait(),sk],{speed:200}),opp:h.unit('E',100000,[h.turnEffectSkill(),attack]),turns:(_,t)=>[t===2?1:0,t===1?0:1]},4);
  assert.equal(r[1].self.currentHp,r[0].self.currentHp,`${side} 施放當回合對手MISS`);
  assert.equal(r[2].self.currentHp,r[1].self.currentHp,`${side} 第二回合對手MISS`);
  assert.ok(r[3].self.currentHp<r[2].self.currentHp,`${side} 第三回合恢復命中`);
  assert.ok(r[1].opp.currentHp<r[0].opp.currentHp,`${side} 不誤給對手閃避`);
  const other=side==='p1'?'p2':'p1';assert.equal(r[1].state[`${other}RegistryState`].attackMissTurns,1);assert.equal(r[2].state[`${other}RegistryState`].attackMissTurns,0);
  checks++;console.log(`✓ ${side} 浪打消回合成功使攻擊方未命中，雙回合到期`);
  const switched=await h.play(side,{self:h.unit('S',100000,[h.wait(),sk],{speed:200}),opp:h.unit('E',100000,[h.turnEffectSkill(),attack]),oppBench:[h.unit('B',100000,[attack])],turns:(_,t)=>[t===2?1:0,t===1?0:t===3?{switch:1}:t===4?0:1]},4);
  assert.equal(switched[2].opp.battleId,'B');assert.ok(switched[3].self.currentHp<switched[2].self.currentHp,`${side} 隊友不繼承未命中`);checks++;
 }
 console.log(`攻擊方限時未命中：${checks} 項通過`);
}finally{await h.close();}
