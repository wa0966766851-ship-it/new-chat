import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
// 2026-11-14：異常從附加當回合起算；後手對自身附加（例：納多雷石契自身石化1回合）回合結束照常扣減。
const h=await createHarness();
try{
 const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 for(const side of ['p1','p2'] as const)for(const target of ['self','opp'])for(const speed of [50,300]){
  const sk=h.kitSkill('附加',[{op:'status',p:{side:target,status:'石化',turns:1,chance:100}}]);
  const [r]=await h.play(side,{self:h.unit('S',10000,[sk],{speed}),opp:h.unit('E',10000,[h.wait()],{speed:150})},1);
  const elf=target==='self'?r.self:r.opp;
  assert.equal(getStatuses(elf)['石化']||0,0,`${side} ${target} 速度${speed}：1回合石化於附加回合結束扣完`);
 }
 console.log('異常當回合起算：自身／對手 × 先後手 × P1/P2 通過');
}finally{await h.close();}
