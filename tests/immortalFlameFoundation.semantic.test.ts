import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 for(const side of ['p1','p2'] as const){
  const summon=h.kitSkill('召喚快照',[{op:'summon_extra_elf',p:{name:'不滅神焰',id:'x_immortal_flame',type:'火',side:'self',statSource:'holder',statFromTeamRatio:1}}]);
  const grow=h.kitSkill('召喚後面板變化',[{op:'stat_points_scale',p:{side:'self',ratio:2,stats:['atk','def','spatk','spdef','speed']}}]);
  const self=h.unit('召喚者',500,[summon,grow],{maxHp:1200,speed:155});
  self.calculatedStats={hp:1200,atk:411,def:277,spatk:222,spdef:288,speed:155};
  const history=await h.play(side,{self,opp:h.unit('對手',10000,[h.wait()]),selfBench:[h.unit('無關隊友',9000,[h.wait()])],turns:(_e,t)=>[t===1?0:1,0]},2);
  const extra=history[0].state[`${side}Team`].find((e:any)=>e.id==='x_immortal_flame');
  assert.ok(extra?.isExtra);
  assert.equal(extra.summonerId,'召喚者');
  assert.equal(extra.currentHp,1200,'複製體力上限，召喚時填滿，不複製召喚者缺血');
  assert.deepEqual(extra.calculatedStats,self.calculatedStats,'六項面板逐項複製，不加總背包隊友');
  assert.deepEqual(history[1].state[`${side}Team`].find((e:any)=>e.id===extra.id).calculatedStats,self.calculatedStats);
  assert.equal(history[1].self.calculatedStats.atk,822,'召喚者後續面板確實變動');
  assert.equal(history[1].state[`${side}Team`].filter((e:any)=>e.id===extra.id).length,1);
  console.log(`✓ ${side} 神焰召喚當下六項面板快照`);
 }
}finally{await h.close();}
