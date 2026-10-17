import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const attack=()=>({...h.wait(),name:'基準攻擊',category:'物理',power:100});
const owner=(id:string)=>DEFAULT_ELVES.find((e:any)=>String(e.id)===id);
const withoutTrait=(value:any)=>{
  const traits=structuredClone(value);
  for(const trait of [traits.exclusiveTrait,...(traits.exclusiveTraits||[])])if(trait?.name==='無序星魂使徒'){trait.effectMode='description';trait.kit=[];}
  return traits;
};
try{
  for(const side of ['p1','p2'] as const){
    const sk=structuredClone(h.find('arena_13','敕赦千銘'));
    const original=owner('arena_13');
    const mk=(move:any)=>({self:h.unit('S',100000,[move],{extra:{name:original.name,soulMark:structuredClone(original.soulMark)}}),opp:h.unit('E',100000,[h.wait()])});
    const [base]=await h.play(side,mk({...attack(),category:sk.category,type:sk.type,power:sk.power}));
    const [full]=await h.play(side,mk(sk));
    assert.equal(100000-full.opp.currentHp,2*(100000-base.opp.currentHp),full.logs.join('\n'));
    checks++;console.log(`✓ ${side} 正式原持有者魂印下敕赦失敗加成只执行一次`);
    for(const id of ['5022','5023','5026']){
      const traits=structuredClone(owner(id).alienTraits);
      const candidates=[traits?.exclusiveTrait,...(traits?.exclusiveTraits||[])].filter(Boolean);
      const trait=candidates.find((t:any)=>t.name==='無序星魂使徒');
      assert.equal(trait?.effectMode,'kit');
      const mkTrait=(enabled:boolean,alien:boolean)=>({self:h.unit('S',100000,[attack()],{extra:{alienTraits:enabled?traits:withoutTrait(traits)}}),opp:h.unit('E',100000,[h.wait()],{extra:{isAlienElf:alien}})});
      const [b]=await h.play(side,mkTrait(false,true));
      const [r]=await h.play(side,mkTrait(true,true));
      assert.equal(100000-r.opp.currentHp,2*(100000-b.opp.currentHp),r.logs.join('\n'));
      const [normal]=await h.play(side,mkTrait(true,false));assert.equal(normal.opp.currentHp,b.opp.currentHp);
      checks++;console.log(`✓ ${side} ${id} 特質對異能翻倍、普通對手不翻倍且無舊倍率重播`);
    }
    const traits=structuredClone(owner('5023').alienTraits);
    const trait=[traits.exclusiveTrait,...(traits.exclusiveTraits||[])].find((t:any)=>t?.name==='無序星魂使徒');
    trait.kit[0].params.clause.body[0].acts[0].p.mult=3;
    const mkEdited=(enabled:boolean)=>({self:h.unit('S',100000,[attack()],{extra:{alienTraits:enabled?traits:withoutTrait(traits)}}),opp:h.unit('E',100000,[h.wait()],{extra:{isAlienElf:true}})});
    const [baseTrait]=await h.play(side,mkEdited(false));const [edited]=await h.play(side,mkEdited(true));
    assert.equal(100000-edited.opp.currentHp,3*(100000-baseTrait.opp.currentHp));
    checks++;console.log(`✓ ${side} 編輯特質倍率後正式引擎使用新值`);
    const mkKill=(alien:boolean)=>({self:h.unit('S',100000,[attack()],{extra:{alienTraits:{exclusiveTrait:trait}}}),opp:h.unit('E',30,[h.wait()],{extra:{isAlienElf:alien}})});
    const [killedAlien]=await h.play(side,mkKill(true));const [killedNormal]=await h.play(side,mkKill(false));
    const other=side==='p1'?'p2':'p1';
    assert.equal(killedAlien.state[`${other}Team`].find((e:any)=>e.id==='E')?.isVanished,true);
    assert.notEqual(killedNormal.state[`${other}Team`].find((e:any)=>e.id==='E')?.isVanished,true);
    checks++;console.log(`✓ ${side} 正式擊敗異能者才消逝；普通陣亡不消逝`);
  }
  console.log(`遷移原生邊界：${checks}項通過；不授予其他定義驗收`);
}finally{await h.close();}
