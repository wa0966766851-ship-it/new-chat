import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {MIGRATED_5016_MECH_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 for(const e of source.kit)assert.equal(kitEntryIssue(e),null,'械/'+e.order);
 const soul=(orders:number[])=>({...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>orders.includes(e.order)))});
 const charges=()=>Array.from({length:5},(_,i)=>({...h.wait(),name:'充能槽'+i,pp:5,maxPp:5,charge:[2,1,0,8,3][i]}));
 for(const side of ['p1','p2'] as const){
  const own=h.unit('場下原持有者',6000,charges(),{extra:{soulMark:soul([105,106])}});
  const [recharge,next]=await h.play(side,{self:h.unit('場上隊友',6000,[h.wait()]),selfBench:[own],opp:h.unit('較高先制受方',6000,[{...h.wait(),priority:1}]),turns:(_e:any,t:number)=>[0,0]},2);
  const original=(r:any)=>r.state[side+'Team'].find((e:any)=>e.id==='場下原持有者');
  assert.deepEqual(original(recharge).skills.map((s:any)=>s.charge),[2,1,0,8,5],'只恢復末位不足原PP上限槽；超上限槽保留');
  assert.deepEqual(original(next).skills.map((s:any)=>s.charge),[2,1,0,8,5],'下回合封鎖正先制後不再符合對手先制較高');
  for(const kind of ['shield','barrier','both',null]){
   const clear=kind?h.kitSkill('消除盾罩',[{op:'clear_shield',p:{side:'opp',kind}}]):h.wait();
   const [v]=await h.play(side,{self:h.unit('盾罩持有者',1000,[h.wait()],{maxHp:6000,speed:100,extra:{soulMark:soul([6,7])}}),opp:h.unit('消除者',20000,[clear],{speed:300})});
   assert.equal(v.self.currentHp,kind?5000:3000,`盾罩${kind}消失提前一次，回合末另一次`);
   assert.equal(v.opp.currentHp,kind?16000:18000,'以實際恢復量造成百分比傷害');
  }
  for(const consumesOwnHp of [false,true]){
   const consumer=h.kitSkill('對手體力消耗',[{op:'consume_current_health',p:{side:consumesOwnHp?'self':'opp'}}]);
   const [v]=await h.play(side,{self:h.unit('支援隊友',1000,[h.wait()]),selfBench:[h.unit('消耗守衛原持有者',5000,charges(),{extra:{soulMark:soul([105])}})],opp:h.unit('體力消耗來源',1000,[consumer],{speed:300})});
   assert.equal(consumesOwnHp?v.opp.currentHp:v.self.currentHp,150,'對手消耗任一方體力均降低15%，不走傷害分類');
   const guard=v.state[side+'Team'][1];assert.equal(guard.skills.reduce((n:number,s:any)=>n+s.charge,0),13,'原主人確實消耗1點隨機充能');
  }
  for(const speed of [100,300]){
   const [v]=await h.play(side,{self:h.unit('異常輸出者',6000,[h.kitSkill('輸出控制異常',[{op:'status',p:{side:'opp',status:'害怕',chance:100,turns:3}}])],{speed,extra:{soulMark:soul([1,107])}}),opp:h.unit('異常目標',6000,[h.wait()],{speed:200})});
   assert.deepEqual(v.state[side+'RegistryState'].mechArchivedStatuses||[],speed===100?['害怕']:[],'極速僅後出手執行控制附加時記錄');
  }
 }
 console.log('機甲場下支援：P1/P2實際先制比較、原持有者末位充能、下回合封鎖、盾罩消失提前與回合末實際恢復、敵方雙向HP消耗減免及充能成本、後手控制記錄通過');
}finally{await h.close();}
