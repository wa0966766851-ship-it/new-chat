import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElves.ts');
 const {normalizeElfStats}=await h.server.ssrLoadModule('/src/utils/elfStats.ts');
 const {resetElfStateForBattle}=await h.server.ssrLoadModule('/src/utils/statCalculator.ts');
 const base=DEFAULT_ELVES.find((e:any)=>e.id==='5053');
 for(const side of ['p1','p2'])for(const level of [1,50,99,100,101,120]){
  const full=normalizeElfStats({...base,level,startingHp:undefined});
  const half=resetElfStateForBattle(normalizeElfStats({...base,level,startingHp:{mode:'percent',value:50}}));
  assert.equal(full.level,level);assert.equal(half.currentHp,Math.floor(half.maxHp/2),`${side} ${level}`);
  const one=resetElfStateForBattle({...full,startingHp:{mode:'absolute',value:1}});assert.equal(one.currentHp,1);
 }
 assert.equal(normalizeElfStats({...base,level:undefined}).level,100);
 assert.ok(normalizeElfStats({...base,level:120}).calculatedStats.atk>normalizeElfStats({...base,level:100}).calculatedStats.atk);
 console.log('一般精靈1–120級、預設100、雙方開戰百分比／指定體力與原有滿血預設通過');
}finally{await h.close();}
