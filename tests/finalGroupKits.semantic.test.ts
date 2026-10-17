// 未接通 73 項最終批（A #17／B #36,#40,#41,#42／C #3,#4,#20,#28,#32,#37）真 Kit 驗收：
// 完整來源與 Kit 一致、不再有舊 handler、Kit 合約通過，並以正式引擎 P1／P2 各跑一回合確認實際效果。
import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_FINAL_A_KITS} from '../src/data/migratedFinalAKits';
import {MIGRATED_FINAL_B_SKILL_KITS} from '../src/data/migratedFinalBKits';
import {MIGRATED_FINAL_C_SKILL_KITS,MIGRATED_FINAL_C_TRAIT_KITS} from '../src/data/migratedFinalCKits';
const h=await createHarness();let checks=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const defs=[...MIGRATED_FINAL_A_KITS,...MIGRATED_FINAL_B_SKILL_KITS,...MIGRATED_FINAL_C_SKILL_KITS];
const sk=(elf:string,name:string)=>structuredClone(h.find(elf,name));
try{
 await check('8 份技能＋通用特性亂舞（共11份定義）真 Kit：完整來源一致、無舊 handler、Kit 合約通過、編譯路由為 kit',()=>{
  assert.equal(defs.length,8);
  for(const d of defs)for(const id of d.elfIds){const s=sk(id,d.name);h.assertKitOnly(s);assert.equal(s.description,d.description,`${id}/${d.name}`);assert.deepEqual(s.kit,d.kit);validateKit(s.kit);}
  for(const t of MIGRATED_FINAL_C_TRAIT_KITS)validateKit(t.kit); // 通用特性亂舞（5022/5023/5026）
 });
 for(const side of ['p1','p2'] as const){
  for(const d of defs){
   await check(`${side} ${d.name}：正式引擎使用一回合不報待接通、技能確實被使用`,async()=>{
    const [r]=await h.play(side,{self:h.unit('S',100000,[sk(d.elfIds[0],d.name)],{maxHp:100000,speed:200,statStages:d.name==='深潛者盛宴'?{atk:-1}:{}}),opp:h.unit('E',1000000,[h.wait(),{...h.wait(),name:'二'},{...h.wait(),name:'三'},{...h.wait(),name:'四'}],{maxHp:1000000,speed:10})});
    assert.ok(r.logs.some((l:string)=>l.includes(`使用了【${d.name}】`)),`${d.name} 未被使用`);
    assert.ok(!r.logs.some((l:string)=>l.includes('效果待接通')),`${d.name} 出現待接通`);
   });
  }
  await check(`${side} 深潛者盛宴：吸取300固定傷害並回復，3回合增傷帶動態異常翻倍旗標`,async()=>{
   const [r]=await h.play(side,{self:h.unit('S',50000,[sk('5007','深潛者盛宴')],{maxHp:100000,speed:200}),opp:h.unit('E',1000000,[h.wait()],{maxHp:1000000,speed:10})});
   assert.ok(1000000-r.opp.currentHp>=300,`對手應至少被吸取300：${r.opp.currentHp}`);
   assert.ok(r.self.currentHp>50000,'吸取後己方回復');
   const timers=(r.state[`${side}Timers`]||[]).filter((t:any)=>t.payload?.block?.doubleIfAnyStatus);
   assert.equal(timers.length,1);assert.equal(timers[0].payload.block.dmgOut,0.5);
  });
  await check(`${side} 不淨者之約：對手全屬性-1、受異常、自身狂暴、對手下2回合先制下降`,async()=>{
   const [r]=await h.play(side,{self:h.unit('S',100000,[sk('5007','不淨者之約')],{maxHp:100000,speed:200,type:'混沌.水'}),opp:h.unit('E',1000000,[h.wait()],{maxHp:1000000,speed:10})});
   for(const k of ['atk','def','spatk','spdef','speed']) assert.equal(r.opp.statStages[k],-1,k);
   assert.ok(h.statuses(r.opp).some((s:string)=>['凍傷','冰封'].includes(s)),'對手被凍傷或冰封');
   assert.ok(h.statuses(r.self).includes('狂暴'),'自身狂暴');
   assert.ok((r.state[`${side==='p1'?'p2':'p1'}Timers`]||[]).some((t:any)=>t.payload?.block?.prio<0),'對手先制下降計時器');
  });
 }
 console.log(`最終批 Kit 驗收 ${checks} 項通過`);
}finally{await h.close();}
process.exit(0);
