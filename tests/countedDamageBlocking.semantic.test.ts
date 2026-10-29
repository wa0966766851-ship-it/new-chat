import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const setup=(p:any={})=>h.kitSkill('一次抵擋',[
  {op:'block_damage_uses',p:{uses:1,kind:'攻擊',key:'test-block',onBlock:[{acts:[{op:'timed_uses',p:{uses:1,kind:'攻擊',trig:'self_after_attack',body:[{cond:[{c:'event_hit',p:{requireAdditional:true},label:'正式命中'}],acts:[{op:'damage_from_counter',p:{key:'test-block',ratio:1,type:'真實',consume:true},label:'等量'}]}]},label:'下次攻擊'}]}],...p}},
]);
const hit=(power=100)=>({...h.wait(),name:'實際攻擊',category:'物理',power,isSureHit:true});
try{
  await check('次數抵擋與成功反應嚴格合約，未知分類／參數及巢狀空殼拒絕',async()=>{
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');assert.equal(sequenceIssue(setup().kit[0].params.clause),null);
    for(const p of [{uses:0},{uses:1.5},{kind:'真實'},{key:''},{onBlock:[]},{onBlock:[{acts:[{op:'未知',p:{},label:'未知'}]}]}])assert.ok(sequenceIssue(setup(p).kit[0].params.clause));
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 只擋一次正式攻擊、護盾保留，下一次命中附加實際抵擋量且僅一次`,async()=>{
      const base=await h.play(side,{self:h.unit('S',10000,[h.wait(),hit(0)],{speed:200}),opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},3);const amount=10000-base[0].self.currentHp;
      const hist=await h.play(side,{self:h.unit('S',10000,[setup(),hit(0)],{speed:200,extra:{shield:1000}}),opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.equal(hist[0].self.currentHp,10000);assert.equal(hist[0].self.shield,1000);assert.equal(hist[1].opp.currentHp,100000-amount);assert.equal(hist[2].opp.currentHp,100000-amount);
      assert.equal(hist[1].self.shield,1000-(base[0].self.currentHp-base[1].self.currentHp));assert.equal(hist[2].self.shield,1000-(base[0].self.currentHp-base[2].self.currentHp));
    });
    await check(`${side} 不擋固定／百分比／真傷與X系技能；抵擋量取上限之後，不提前反彈`,async()=>{
      for(const type of ['固定','百分比','真實','技能']){
        const own=setup(),damage=h.kitSkill('非攻擊',[{op:'dmg',p:{flat:500,type,...(type==='技能'?{elem:'普通'}:{})}}]);
        const [r]=await h.play(side,{self:h.unit('S',10000,[own],{speed:200}),opp:h.unit('E',100000,[damage])});assert.equal(r.self.currentHp,9500,type);assert.equal(r.opp.currentHp,100000);
        assert.ok(r.state[`${side}Timers`].some((t:any)=>t.payload?.block?.recordBlockedDamage==='test-block'));
      }
      const own=setup();own.kit[0].params.clause.body[0].acts.unshift({op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'攻擊',cap:50,turns:3,next:false},label:'上限'});
      const hist=await h.play(side,{self:h.unit('S',10000,[own,hit(0)],{speed:200}),opp:h.unit('E',100000,[hit(1000)]),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.equal(hist[0].opp.currentHp,100000);assert.equal(hist[1].opp.currentHp,99950);assert.equal(hist[1].self.currentHp,9950);
      const typed=h.kitSkill('X系技能傷害',[{op:'dmg',p:{flat:500,type:'技能',elem:'普通'}}]);
      const skillRange=await h.play(side,{self:h.unit('S',10000,[setup({kind:'技能'}),hit(0)],{speed:200}),opp:h.unit('E',100000,[typed,h.wait()]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);
      assert.equal(skillRange[0].self.currentHp,10000);assert.equal(skillRange[1].opp.currentHp,99500);
    });
    await check(`${side} 零傷害與無視抵擋不耗次數、不建立反應；下場不把容器轉給下一隻`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',10000,[setup(),h.wait()],{speed:200}),opp:h.unit('E',100000,[hit(0),hit()]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);
      assert.ok(hist[0].state[`${side}Timers`].some((t:any)=>t.payload?.block?.recordBlockedDamage==='test-block'));assert.equal(hist[1].self.currentHp,10000);
      const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');h.S.E=(_:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&!d.damageComp.isIncoming)d.damageComp.attackDefenseBypass={block:true};};
      try{const [r]=await h.play(side,{self:h.unit('S',10000,[setup()],{speed:200}),opp:h.unit('E',100000,[hit()])});assert.ok(r.self.currentHp<10000);assert.ok(r.state[`${side}Timers`].some((t:any)=>t.payload?.block?.recordBlockedDamage==='test-block'));}finally{delete h.S.E;}
      const swap=await h.play(side,{self:h.unit('S',10000,[setup()],{speed:200}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',100000,[hit()]),turns:(_,t)=>[t===1?0:{switch:1},0]},2);assert.ok(swap[1].self.currentHp<10000);
      const isolated=await h.play(side,{self:h.unit('S',10000,[setup()],{speed:200}),selfBench:[h.unit('B',10000,[setup(),hit(0)],{speed:200})],opp:h.unit('E',100000,[hit(),h.wait()]),turns:(_,t)=>[t===2?{switch:1}:t===4?1:0,t===4?1:0]},4);
      const lastBlock=isolated[2].logs.filter((s:string)=>s.includes('抵擋了')&&s.includes('攻擊傷害')).at(-1)!;
      const recorded=Number(lastBlock.match(/抵擋了 (\d+) 點/)![1]);assert.equal(isolated[2].state[`${side}RegistryState`]['blockCounter:test-block'],recorded);
      assert.equal(100000-isolated[3].opp.currentHp,recorded,isolated[3].logs.join('\n'));
    });
  }
  console.log(`次數抵擋與正式量反應：${checks}項通過`);
}finally{await h.close();}
