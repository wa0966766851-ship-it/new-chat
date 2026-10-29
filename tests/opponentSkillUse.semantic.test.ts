import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const add=(id:string)=>({op:'resource_mark_add',p:{side:'self',id,name:id,displayChar:'記',unit:'層',scope:'elf',persistsOffField:true,description:'正式出手事件測試',amount:1},label:id});
const soul={name:'使用紀錄',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'round_end',source:'soulmark',role:'innate',order:0,
  params:{clause:{raw:'對手本回合正式使用技能時記一次，否則記未使用',trig:'round_end',parsed:true,body:[{cond:[{c:'opp_used_skill',p:{},label:'本回合使用技能'}],acts:[add('used_round')],elseActs:[add('unused_round')]}]}}}]};
const count=(r:any,side:string,id:string)=>(r.state[`${side}Marks`]||[]).filter((m:any)=>m.id===id&&m.ownerBattleId==='S').reduce((n:number,m:any)=>n+m.count,0);
try {
  for(const side of ['p1','p2'] as const){
    for(const name of ['等待','待機']){
      const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:structuredClone(soul)}}),opp:h.unit('E',10000,[{...h.wait(),name}])});
      assert.equal(count(r,side,'used_round'),1,JSON.stringify({logs:r.logs,marks:r.state[`${side}Marks`],reg:r.state[`${side}RegistryState`]}));assert.equal(count(r,side,'unused_round'),0);checks++;
    }
    const [miss]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:structuredClone(soul)}}),opp:h.unit('E',10000,[{...h.wait(),name:'必定未命中',isSureHit:false,accuracy:0}])});
    assert.equal(count(miss,side,'used_round'),1);assert.equal(count(miss,side,'unused_round'),0);checks++;
    const history=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:structuredClone(soul)}}),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('B',10000,[h.wait()])],turns:(_,t)=>[0,t===2?{switch:1}:0]},3);
    assert.deepEqual(history.map(r=>count(r,side,'used_round')),[1,1,2]);
    assert.deepEqual(history.map(r=>count(r,side,'unused_round')),[0,1,1]);checks++;
    console.log(`✓ ${side} 真實使用／名稱待機／未命中仍使用；主動切換不使用且不繼承上回合紀錄`);
  }
  console.log(`${checks} opponent skill use checks passed`);
}finally{await h.close();}
