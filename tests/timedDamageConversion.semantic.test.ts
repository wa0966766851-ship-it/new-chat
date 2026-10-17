import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const setup=(p:any={})=>h.kitSkill('兩回合轉療',[{op:'damage_to_heal_turns',p:{turns:2,kind:'攻擊',next:false,...p}}]);
const hit=()=>h.kitSkill('固定主攻擊',[],{category:'物理',power:100});
try{
  await check('轉療合約要求有限期限與明確範圍，正式零量不回復、單份傷害不多次轉療',async()=>{
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    assert.equal(sequenceIssue(setup().kit[0].params.clause),null);
    for(const p of [{turns:0},{turns:1.5},{kind:'真實'},{next:'true'},{kind:'未命名'}])assert.ok(sequenceIssue(setup(p).kit[0].params.clause));
    const {resolveDamageBlocking}=await h.server.ssrLoadModule('/src/battle/damageBlocking.ts');let heal=0;
    const c:any={damageCategory:'skill_attack',damageConversions:new Map([['a',(n:number)=>heal+=n],['b',(n:number)=>heal+=n]])};
    assert.equal(resolveDamageBlocking(c,200),0);assert.equal(heal,200);assert.equal(c.incomingDamageCancellation,'conversion');
    c.damageConversions=new Map([['a',(n:number)=>heal+=n]]);assert.equal(resolveDamageBlocking(c,0),0);assert.equal(c.damageConversions.size,0);assert.equal(heal,200);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 當回合起兩回合轉正式攻擊量，第三回合到期，護盾不受傷`,async()=>{
      const base=await h.play(side,{self:h.unit('S',30000,[h.wait()]),opp:h.unit('E',100000,[hit()])},3);
      const history=await h.play(side,{self:h.unit('S',10000,[setup(),h.wait()],{maxHp:50000,speed:200,extra:{shield:100}}),opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},3);
      const amounts=base.map((r,i)=>(i?base[i-1].self.currentHp:30000)-r.self.currentHp);
      assert.equal(history[0].self.currentHp,10000+amounts[0]);assert.equal(history[1].self.currentHp,10000+amounts[0]+amounts[1]);
      assert.equal(history[0].self.shield,100);assert.equal(history[1].self.shield,100);assert.equal(history[2].self.shield,0);
      assert.equal(history[2].self.currentHp,history[1].self.currentHp-Math.max(0,amounts[2]-100));
    });
    await check(`${side} 不轉固定／百分比／真傷／X系技能；傷害上限後才取轉療量`,async()=>{
      for(const type of ['固定','百分比','真實','技能']){
        const damage=h.kitSkill('附加類別',[{op:'dmg',p:{flat:500,type,...(type==='技能'?{elem:'普通'}:{})}}]);
        const [r]=await h.play(side,{self:h.unit('S',10000,[setup()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[damage])});
        assert.equal(r.self.currentHp,9500,type+'\n'+r.logs.join('\n'));
      }
      const own=h.kitSkill('上限與转療',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'攻擊',cap:200,turns:2,next:false}},{op:'damage_to_heal_turns',p:{kind:'攻擊',turns:2,next:false}}]);
      const [r]=await h.play(side,{self:h.unit('S',10000,[own],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[{...hit(),power:1000}])});assert.equal(r.self.currentHp,10200,r.logs.join('\n'));
    });
    await check(`${side} 下兩回合待啟用、禁療仍擋恢復、無視轉化照常造成傷害`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',10000,[setup({next:true}),h.wait()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.ok(hist[0].self.currentHp<10000);assert.ok(hist[1].self.currentHp>hist[0].self.currentHp);assert.ok(hist[2].self.currentHp>hist[1].self.currentHp);assert.ok(hist[3].self.currentHp<hist[2].self.currentHp);
      const forbidden=h.kitSkill('禁療攻擊',[{op:'no_heal',p:{turns:1,next:false}}],{category:'物理',power:100});
      const [blocked]=await h.play(side,{self:h.unit('S',10000,[setup()],{maxHp:50000,speed:200}),opp:h.unit('E',100000,[forbidden])});assert.equal(blocked.self.currentHp,10000,blocked.logs.join('\n'));
      const attacker=h.unit('E',100000,[hit()]);
      const {getSoulMarkRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');const registry=getSoulMarkRegistry();
      registry.E=(_:any,e:any,data:any)=>{if(e===T.BEFORE_DAMAGE&&!data.damageComp.isIncoming)data.damageComp.attackDefenseBypass={conversion:true};};
      try{const [r]=await h.play(side,{self:h.unit('S',10000,[setup()],{maxHp:50000,speed:200}),opp:attacker});assert.ok(r.self.currentHp<10000,r.logs.join('\n'));}finally{delete registry.E;}
    });
  }
  console.log(`明確期限／範圍傷害轉療：${checks}項通過`);
}finally{await h.close();}
