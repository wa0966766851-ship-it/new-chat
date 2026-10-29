import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
  const {MIGRATED_5016_MECH_SOUL_KIT:source}=await h.server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts');
  for(const side of ['p1','p2'] as const){
    const soul={...source,name:'改名充能魂印',effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>e.node==='before_action'||e.node==='battle_phase_end'))};
    const attack={...h.wait(),name:'同名充能槽',category:'特殊',power:100,charge:8,ppUnlimited:true,isSureHit:true};
    const self=h.unit('雙槽充能持有者',1000,[attack,{...attack,charge:4}],{maxHp:10000,extra:{soulMark:soul}});
    const foe=h.unit('充能真傷受方',100000,[h.wait()],{extra:{shield:99999,barrier:99999}});
    const receipts:any[]=[];
    h.S[foe.name]=(_c:any,event:string,data:any)=>{if(event==='ON_DAMAGED')receipts.push(data.receipt);};
    const history=await h.play(side,{self,opp:foe,turns:()=>[1,0]},2);
    assert.deepEqual(history[0].self.skills.map((s:any)=>s.charge),[8,4],'階段結束只準備下回合，不立即扣充能');
    assert.deepEqual(history[1].self.skills.map((s:any)=>s.charge),[8,0],'同名僅消耗實際選擇的第二槽，不選最高值');
    assert.equal(history[1].opp.currentHp,99940,'60真傷穿盾罩');
    assert.equal(history[1].self.currentHp,1060,'汲取只回復一次60，不重複回血');
    assert.deepEqual(history[1].self.skills.map((s:any)=>s.pp),[99,99],'不扣PP');
    assert.equal(receipts.filter(r=>r.damageType==='true'&&r.hpLost===60).length,1,'正式扣血回執恰好一次');
    const run=async(boost:number)=>{
      const kit=structuredClone(soul.kit);
      kit.find((e:any)=>e.node==='before_action').params.clause.body[0].acts[0].p.boostRatio=boost;
      const a=h.unit('增傷充能者',1000,[{...attack,charge:4}],{maxHp:10000,extra:{soulMark:{...soul,kit}}});
      return h.play(side,{self:a,opp:h.unit('增傷受方',100000,[h.wait()])},3);
    };
    const base=await run(0),boosted=await run(1.5);
    assert.equal(base[0].opp.currentHp,boosted[0].opp.currentHp,'首回合尚未觸發超頻');
    const baseline=base[0].opp.currentHp-base[1].opp.currentHp-60;
    const amplified=boosted[0].opp.currentHp-boosted[1].opp.currentHp-60;
    assert.ok(amplified>=baseline*2.5-2&&amplified<=baseline*2.5+2,'當回合主攻擊傷害提升150%');
    assert.equal(base[1].opp.currentHp-base[2].opp.currentHp,boosted[1].opp.currentHp-boosted[2].opp.currentHp,'增傷不外洩到下一回合無充能攻擊');
    const noAttack=h.unit('屬性不耗充能者',1000,[{...h.wait(),charge:3}, {...attack,charge:9}],{maxHp:10000,extra:{soulMark:soul}});
    const status=await h.play(side,{self:noAttack,opp:h.unit('屬性受方',100000,[h.wait()])},2);
    assert.deepEqual(status[1].self.skills.map((s:any)=>s.charge),[3,9],'屬性技能不得消耗另一槽充能或造成汲取');
    assert.equal(status[1].opp.currentHp,100000);
  }
  console.log('充能超頻：P1/P2正式60真傷、單次等量回血、同名槽、PP隔離、150%增傷與期限通過');
}finally{await h.close();}
