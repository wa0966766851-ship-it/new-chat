import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_BLOCK_RECOVERY_SKILL_KITS as defs} from '../src/data/migratedBlockRecoverySkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const skill=()=>structuredClone(h.find('5016','源生壁壘'));
const a=(op:string,p:any)=>({op,p,label:op});
const trait=(acts:any[])=>({name:'測試防護',description:'防護',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,
  params:{clause:{raw:'防護',trig:'entrance',parsed:true,body:[{acts}]}}}]});
const immune=()=>trait([a('immune_status_turns',{turns:10,reflect:false})]);
const physical=()=>({...h.wait(),name:'攻擊',category:'物理',power:100});
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {legalActions:legalBattleActions}=await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
const registry=getBattleSkillRegistry(),old=registry['源生壁壘'];registry['源生壁壘']=()=>{calls++;throw new Error('Kit不可回到舊技能');};
const setBase=(_c:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&!d.damageComp.isIncoming&&d.damageComp.damageCategory==='skill_attack')d.damageComp.base=1000;};
h.S.S=setBase;h.S.E=setBase;
try{
  let edited:any;
  await check('正式完整原文、五分句六條目、正確持有者及Blockly修改後保存重載',()=>{
    const sk=skill();assert.equal(sk.effectMode,'kit');assert.equal(sk.description,(source as any)['5016'].skills[sk.name].d);
    assert.equal(sk.description,defs[0].description);assert.deepEqual(sk.kit,defs[0].kit);validateKit(sk.kit);
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{
      edited={...sk,kit:sk.kit.map((e:any)=>{
        const b=buildEntryBlock(w as any,e)!;assert.ok(b);
        const action=w.getAllBlocks(false).find((x:any)=>x.type==='sequence_action'&&x.getFieldValue('OP')==='block_damage_uses');
        if(action){const p=JSON.parse(action.getFieldValue('PARAMS'));p.onBlock[0].acts[1].p.ratio=2;action.setFieldValue(JSON.stringify(p),'PARAMS');}
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
        const back=createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order)!;
        if(e.order!==5)assert.deepEqual(back,e);
        w.clear();r.clear();return back;
      })};validateKit(edited.kit);
      assert.equal(edited.kit[5].params.clause.body[0].acts[0].p.onBlock[0].acts[1].p.ratio,2);
    }finally{w.dispose();r.dispose();}
  });
  await check('抵擋量恢復／每回合容器拒絕非法鍵、比例、消耗旗標與空內文',()=>{
    for(const p of [{key:''},{ratio:0},{ratio:NaN},{consume:'yes'},{handler:'legacy'}])assert.throws(()=>validateKit(h.kitSkill('無效',[a('heal_from_counter',{key:'x',ratio:1,consume:true,...p})]).kit));
    for(const p of [{key:'',body:[{acts:[a('heal_flat',{amount:1})]}]},{key:'x',body:[]}])assert.throws(()=>validateKit(h.kitSkill('無效',[a('once_per_round',p)]).kit));
  });
  for(const side of ['p1','p2'] as const){
    const other=side==='p1'?'p2':'p1';
    await check(`${side} 滿PP先制3、不滿PP不提升，實際行動排序`,async()=>{
      for(const [full,priority,expected] of [[true,2,'S'],[false,2,'E'],[true,4,'E']] as const){
        const order:string[]=[];h.S.S=(c:any,e:any,d:any)=>{setBase(c,e,d);if(e===T.BEFORE_ACTION)order.push('S');};
        h.S.E=(c:any,e:any,d:any)=>{setBase(c,e,d);if(e===T.BEFORE_ACTION)order.push('E');};
        const sk=skill();sk.maxPp=sk.pp;if(!full)sk.pp-=1;
        await h.play(side,{self:h.unit('S',10000,[sk],{speed:10}),opp:h.unit('E',10000,[{...h.wait(),priority}],{speed:500})});
        assert.equal(order[0],expected);
      }h.S.S=setBase;h.S.E=setBase;
    });
    await check(`${side} 完整技能弱化三回合含施放回合，第三回合後不再刷新封切`,async()=>{
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',10000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(r.slice(0,3).map(x=>[x.opp.statStages.speed,x.opp.statStages.accuracy]),[[-2,-2],[-4,-4],[-6,-6]]);
      assert.equal(r[4].opp.statStages.speed,-6);assert.equal(r[4].state[`${other}RegistryState`]?.noSwitchTurns||0,0);
    });
    await check(`${side} 雙項弱化均失敗才封切兩回合，真正合法操作拒絕換人、期限後恢復`,async()=>{
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',10000,[h.wait()],{extra:{trait:trait([a('immune_statdown_turns',{turns:10})])}}),
        oppBench:[h.unit('B',10000,[h.wait()])],turns:(_,t)=>[t===1?0:1,0]},5);
      assert.equal(r[0].opp.statStages.speed||0,0);
      assert.ok(!legalBattleActions(r[0].state,other).some((x:any)=>x.kind==='switch'));
      assert.ok(legalBattleActions(r[4].state,other).some((x:any)=>x.kind==='switch'));
    });
    await check(`${side} 吸取監看四回合含施放回合，第五回合停止，屬性等待不觸發`,async()=>{
      const attack={...h.kitSkill('攻擊恢復',[a('heal',{side:'self',ratio:1})]),category:'物理',power:100};
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:1000000,speed:200}),
        opp:h.unit('E',20000,[attack],{extra:{trait:immune()}}),turns:(_,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(r.map(x=>x.self.currentHp),[17666,23332,28998,34664,33664],r[4].logs.join('\n'));
      const [wait]=await h.play(side,{self:h.unit('S',10000,[skill()]),opp:h.unit('E',20000,[h.wait()])});assert.equal(wait.opp.currentHp,20000);
    });
    await check(`${side} 抵擋一次1000後真傷1000與回復1000；百分比免疫不讓吸取污染結果`,async()=>{
      const defense=h.kitSkill('百分比免疫',[a('dmg_mod_turns',{side:'self',dir:'in',kind:'百分比',reduce:1,turns:10})],{priority:10});
      const r=await h.play(side,{self:h.unit('S',5000,[skill(),h.wait()],{maxHp:10000}),opp:h.unit('E',100000,[defense,physical()],{extra:{trait:immune()}}),
        turns:(_,t)=>[t===1?0:1,t===1?0:1]},3);
      assert.equal(r[0].self.currentHp,5000);assert.equal(r[1].self.currentHp,6000,r[1].logs.join('\n'));
      assert.equal(r[1].opp.currentHp,99000);assert.equal(r[2].self.currentHp,5000);assert.equal(r[2].opp.currentHp,99000);
      assert.equal(r[1].state[`${side}RegistryState`]['blockCounter:blockedRecovery'],0);
    });
    await check(`${side} 真傷擊敗對手仍回血；回復取原抵擋量而非剩餘HP上限，Blockly改倍率生效`,async()=>{
      // 只隔離正式第五條作為數值控制；完整技能與其他條款另有上列正式來源整合情境。
      const sk={...structuredClone(edited),name:'改名抵擋',kit:edited.kit.filter((e:any)=>e.order===5)};
      const [r]=await h.play(side,{self:h.unit('S',1000,[sk],{maxHp:10000,speed:200}),opp:h.unit('E',200,[physical()])});
      assert.equal(r.opp.currentHp,0);assert.equal(r.self.currentHp,3000,r.logs.join('\n'));
    });
    await check(`${side} 四回合內攻擊觸發癱瘓；未使用該技及持有者下場不借監看/抵擋`,async()=>{
      const [yes]=await h.play(side,{self:h.unit('S',1000,[skill()],{maxHp:10000}),opp:h.unit('E',30000,[physical()])});
      assert.ok(h.statuses(yes.opp).includes('癱瘓'),yes.logs.join('\n'));
      const [no]=await h.play(side,{self:h.unit('S',10000,[h.wait(),skill()]),opp:h.unit('E',30000,[physical()])});assert.equal(no.self.currentHp,9000);
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),selfBench:[h.unit('B',10000,[h.wait()])],
        opp:h.unit('E',30000,[h.wait(),physical()],{extra:{trait:immune()}}),turns:(_,t)=>[t===2?{switch:1}:0,t===1?0:1]},2);
      assert.equal(r[1].self.id,'B');assert.equal(r[1].self.currentHp,9000);assert.equal(r[1].opp.currentHp,30000);
    });
    await check(`${side} 每回合容器同回合多次事件只執行一次，下回合重新開放`,async()=>{
      const once=a('once_per_round',{key:'repeated',body:[{acts:[a('heal_flat',{amount:100})]}]});
      const s=h.kitSkill('兩次通知',[once,once]);
      const r=await h.play(side,{self:h.unit('S',1000,[s],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()])},2);
      assert.deepEqual(r.map(x=>x.self.currentHp),[1100,1200]);
    });
    await check(`${side} 重放正式壁壘刷新監看，同回合舊事件與新初次補發不重複弱化`,async()=>{
      const r=await h.play(side,{self:h.unit('S',10000,[skill()]),opp:h.unit('E',10000,[h.wait()])},2);
      assert.deepEqual(r.map(x=>[x.opp.statStages.speed,x.opp.statStages.accuracy]),[[-2,-2],[-4,-4]]);
    });
    await check(`${side} 任一項弱化成功不誤封切；附加封印不建立監看與抵擋`,async()=>{
      const [partial]=await h.play(side,{self:h.unit('S',10000,[skill()]),opp:h.unit('E',30000,[h.wait()],{statStages:{speed:-6}}),oppBench:[h.unit('B',10000,[h.wait()])]});
      assert.equal(partial.opp.statStages.speed,-6);assert.equal(partial.opp.statStages.accuracy,-2);
      assert.ok(legalBattleActions(partial.state,other).some((x:any)=>x.kind==='switch'));
      const [sealed]=await h.play(side,{self:h.unit('S',10000,[skill()],{extra:{isAdditionalInvalid:true}}),opp:h.unit('E',30000,[physical()])});
      assert.equal(sealed.self.currentHp,9000);assert.equal(sealed.opp.currentHp,30000);assert.equal(sealed.opp.statStages.speed||0,0);
      assert.ok(!h.statuses(sealed.opp).includes('癱瘓'));assert.equal(sealed.state[`${side}Timers`].length,0);
    });
    await check(`${side} 禁療阻止抵擋恢復仍消耗計數；零傷害不抵擋不耗次數`,async()=>{
      const sk={...skill(),kit:skill().kit.filter((e:any)=>e.order===5)};
      const attack=h.kitSkill('攻擊禁療',[a('no_heal',{turns:2,scope:'all'})],{category:'物理',power:100});
      const [banned]=await h.play(side,{self:h.unit('S',1000,[sk],{maxHp:10000,speed:200}),opp:h.unit('E',30000,[attack])});
      assert.equal(banned.self.currentHp,1000);assert.equal(banned.opp.currentHp,29000,banned.logs.join('\n'));
      assert.equal(banned.state[`${side}RegistryState`]['blockCounter:blockedRecovery'],0);
      const [zero]=await h.play(side,{self:h.unit('S',1000,[sk],{maxHp:10000,speed:200}),opp:h.unit('E',30000,[{...physical(),power:0}])});
      assert.equal(zero.self.currentHp,1000);assert.equal(zero.opp.currentHp,30000);
      assert.ok(zero.state[`${side}Timers`].some((t:any)=>t.payload?.block?.recordBlockedDamage==='blockedRecovery'));
    });
  }
  assert.equal(calls,0);console.log(`${checks} 源生壁壘完整遷移／通用容器驗證通過`);
}finally{delete h.S.S;delete h.S.E;if(old===undefined)delete registry['源生壁壘'];else registry['源生壁壘']=old;await h.close();}
