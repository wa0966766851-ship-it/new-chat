import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try {
  for(const side of ['p1','p2'] as const){
    const root=structuredClone(h.find('5035','纏根'));
    h.assertKitOnly(root);
    const invalid=root.kit.find((e:any)=>e.order===9);
    assert.equal(invalid.node,'on_invalid');
    assert.equal(invalid.params.clause.trig,'self_invalid');
    const opponent={...h.wait(),pp:30,maxPp:30,priority:-10};
    const [r]=await h.play(side,{self:h.unit('caster',10000,[root],{speed:300}),opp:h.unit('recipient',1000000,[opponent])});
    assert.equal(r.opp.skills[0].pp,9,'正常屬性技能消耗20PP，回合末再被吸取1PP');
    const other=side==='p1'?'p2':'p1';
    const timer=r.state[other+'Timers'].find((t:any)=>t.payload?.block?.ppMult===20);
    assert.equal(timer?.remaining,4,'當回合立即生效並保留餘下4回合，正常施放不誤執行無效分支');
  }
  console.log('纏根正常施放／技能無效分支隔離：P1/P2正式後台PP數值與期限通過');
}finally{await h.close();}
