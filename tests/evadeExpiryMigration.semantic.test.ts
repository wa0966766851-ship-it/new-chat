import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {validateKit} from '../src/effects/kitValidation';
const h=await createHarness();let checks=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const skill=()=>h.kitSkill('迴避到期恢復',[{op:'evade_turns',p:{turns:2,chance:100,kind:'攻擊',onExpire:[{acts:[{op:'heal_flat',p:{amount:1000},label:'回復'},{op:'pp_op',p:{side:'self',mode:'add',amount:3},label:'回PP'}]}]}}],{pp:5,maxPp:10});
try{
 validateKit(skill().kit);
 for(const side of ['p1','p2'] as const){
  await check(`${side} 閃避兩回合到期才恢復1000及每槽3PP，僅執行一次`,async()=>{
   const attack={...h.wait(),name:'非必中攻擊',category:'物理',power:20,isSureHit:false};
   const r=await h.play(side,{self:h.unit('S',5000,[skill(),{...h.wait(),pp:10,maxPp:20}],{maxHp:10000,speed:200}),opp:h.unit('E',1000000,[attack]),turns:(_,t)=>[t===1?0:1,0]},3);
   assert.equal(r[0].self.currentHp,5000);assert.equal(r[1].self.currentHp,6000);assert.ok(r[2].self.currentHp<6000);assert.equal(r[1].self.skills[0].pp,7);assert.equal(r[1].self.skills[1].pp,12);assert.equal(r[2].self.skills[0].pp,7);
  });
  await check(`${side} 提前消除及下場不執行自然到期分支，替補不借`,async()=>{
   const clear=h.kitSkill('消回合',[{op:'clear_turn',p:{side:'opp'}}]);const r=await h.play(side,{self:h.unit('S',5000,[skill(),h.wait()],{maxHp:10000,speed:200}),opp:h.unit('E',1000000,[h.wait(),clear]),turns:(_,t)=>[t===1?0:1,t===2?1:0]},3);for(const row of r)assert.equal(row.self.currentHp,5000);assert.equal(r[2].self.skills[0].pp,4);
   const sw=await h.play(side,{self:h.unit('S',5000,[skill(),h.wait()],{maxHp:10000,speed:200}),selfBench:[h.unit('B',5000,[h.wait()],{maxHp:10000})],opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:{switch:0},0]},3);for(const row of sw)assert.equal(row.self.currentHp,5000);assert.equal(sw[2].self.skills[0].pp,4);
  });
 }
 console.log(`閃避自然到期 ${checks} 項通過`);
}finally{await h.close();}
process.exit(0);
