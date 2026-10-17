import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {hasAllStageDirection} from '../src/effects/stageQueries';
import {activeConstraints} from '../src/battle/timedConstraints';
import {MIGRATED_RANDOM_STAGE_SKILL_KITS as defs} from '../src/data/migratedRandomStageSkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const skill=()=>structuredClone(h.find('5018','蟲群庇護'));
const keys=['atk','def','spatk','spdef','speed','accuracy'];
const stages=(v:number)=>Object.fromEntries(keys.map(k=>[k,v]));
const a=(op:string,p:any)=>({op,p,label:op});
const trait=(acts:any[])=>({name:'通用防護',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,
  params:{clause:{raw:'防護',trig:'entrance',parsed:true,body:[{acts}]}}}]});
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {legalActions}=await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const registry=getBattleSkillRegistry(),old=registry['蟲群庇護'];registry['蟲群庇護']=()=>{calls++;throw new Error('舊蟲群庇護不准重播');};
try{
  let edited:any;
  await check('六條完整原文與正式封裝、全部Blockly往返、編輯隨機項數並重載',()=>{
    const sk=skill();assert.equal(sk.effectMode,'kit');assert.equal(sk.description,(source as any)['5018'].skills[sk.name].d);
    assert.equal(sk.description,defs[0].description);assert.deepEqual(sk.kit,defs[0].kit);validateKit(sk.kit);
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{edited={...sk,kit:sk.kit.map((e:any)=>{
      const b=buildEntryBlock(w as any,e)!;assert.ok(b);
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
      assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
      const timer=r.getAllBlocks(false).find((x:any)=>x.type==='sequence_action'&&x.getFieldValue('OP')==='timed');
      if(timer){const p=JSON.parse(timer.getFieldValue('PARAMS'));if(p.trig==='round_start'){
        p.body[0].acts[0].p.count=6;timer.setFieldValue(JSON.stringify(p),'PARAMS');
      }}
      const saved=Blockly.serialization.workspaces.save(r);w.clear();Blockly.serialization.workspaces.load(saved,w);
      const back=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return back;
    })};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  });
  await check('六項完整下降查詢不含HP、視為能力或缺值；錯誤方向與未知欄位拒絕',()=>{
    assert.equal(hasAllStageDirection({statStages:stages(-1)},'down'),true);
    for(const bad of [{...stages(-1),accuracy:0},{...stages(-1),accuracy:NaN},{...stages(-1),accuracy:1},{atk:-6,hp:-6}])assert.equal(hasAllStageDirection({statStages:bad},'down'),false);
    for(const p of [{side:'both',kind:'down'},{side:'opp',kind:'all'},{side:'opp',kind:'down',handler:'legacy'}]){
      const sk=h.kitSkill('錯誤查詢',[a('heal_flat',{amount:1})]);sk.kit[0].params.clause.body[0].cond=[{c:'stage_all',p}];assert.throws(()=>validateKit(sk.kit));
    }
  });
  await check('共用切換讀取遵守待啟用、到期與個體／陣營，未展開其他積木鍵',()=>{
    const timer:any={id:'x',remaining:2,ownerBattleId:'E',scope:'elf',payload:{block:{lockSwitch:true,blockAttack:true}}};
    const elf:any={id:'E',battleId:'E'};
    assert.equal(activeConstraints([timer],elf)[0].lockSwitch,true);
    assert.equal(activeConstraints([timer],elf)[0].blockAttack,undefined,'抵擋攻擊不是禁止持有者使用攻擊技能');
    for(const patch of [{remaining:0},{pendingActivation:true},{ownerBattleId:'B'}])assert.equal(activeConstraints([{...timer,...patch}],elf).length,0);
    assert.equal(activeConstraints([{...timer,scope:'team',ownerBattleId:'B'}],elf)[0].lockSwitch,true);
    assert.equal(activeConstraints([{...timer,payload:{lockSwitch:true}}],elf)[0].lockSwitch,true);
  });
  for(const side of ['p1','p2'] as const){
    const other=side==='p1'?'p2':'p1';
    await check(`${side} 回合初三項不重複下降，自己只獲實際下降量，第三回合後停止`,async()=>{
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',10000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(r[0].self.statStages,{});assert.deepEqual(r[0].opp.statStages,{});
      const first=keys.filter(k=>r[1].opp.statStages[k]<0);assert.equal(first.length,3);
      assert.equal(keys.reduce((n,k)=>n+(r[1].self.statStages[k]||0),0),3);
      for(const k of keys)assert.equal(r[1].self.statStages[k]||0,Math.abs(r[1].opp.statStages[k]||0));
      assert.equal(keys.reduce((n,k)=>n+(r[2].self.statStages[k]||0),0),6);
      assert.deepEqual(r[3].self.statStages,r[2].self.statStages);
    });
    await check(`${side} 吸取後仍非六項皆負才封下一、下二回合，建立當回合尚可換人`,async()=>{
      const canSwitch:boolean[]=[];
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',10000,[h.wait()]),oppBench:[h.unit('B',10000,[h.wait()])],turns:(engine,t)=>{
        canSwitch.push(legalActions(engine.getState(),other).some((x:any)=>x.kind==='switch'));return[t===1?0:1,0];
      }},6);
      assert.ok(legalActions(r[0].state,other).some((x:any)=>x.kind==='switch'));
      assert.ok(!legalActions(r[1].state,other).some((x:any)=>x.kind==='switch'),'第2回合結束啟用，限制第3回合選擇');
      assert.deepEqual(canSwitch.slice(0,4),[true,true,false,false],'回合初判定後，第3、4回合真正禁止換人');
      assert.ok(legalActions(r[5].state,other).some((x:any)=>x.kind==='switch'));
    });
    await check(`${side} 玩家正式換人入口真正拒絕第3、4回合換人`,async()=>{
      let denied=0;
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',10000,[h.wait()]),
        oppBench:[h.unit('B',10000,[h.wait()])],turns:(engine,t)=>{
          if(t===3||t===4){
            if(other==='p2')engine.onSkillSelect('p1',engine.getState().p1.skills[1]);
            const before=engine.getState();assert.equal(before.phase,`${other}_select`);
            engine.onSwitchElf(other,1);const after=engine.getState();
            assert.equal(after.phase,before.phase);assert.equal(after[`${other}SwitchIndex`],before[`${other}SwitchIndex`]);denied++;
          }
          return[t===1?0:1,0];
        }},4);
      assert.equal(denied,2);assert.equal(r[3].opp.id,'E');
    });
    await check(`${side} 六項早已下降不誤封切；降至下限或免疫時不憑空強化自己`,async()=>{
      for(const mode of ['down','floor','immune']){
        const start=mode==='down'?stages(-1):mode==='floor'?stages(-6):{};
        const extra=mode==='immune'?{trait:trait([a('immune_statdown_turns',{turns:10})])}:{};
        const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',10000,[h.wait()],{statStages:start,extra}),
          oppBench:[h.unit('B',10000,[h.wait()])],turns:(_,t)=>[t===1?0:1,0]},3);
        if(mode!=='immune')assert.ok(legalActions(r[2].state,other).some((x:any)=>x.kind==='switch'));
        if(mode!=='down')assert.equal(keys.reduce((n,k)=>n+(r[2].self.statStages[k]||0),0),0);
      }
    });
    await check(`${side} Blockly改六項並改名後全六項變負，執行後即時查詢不誤封切`,async()=>{
      const renamed={...structuredClone(edited),name:'自訂庇護'};
      const r=await h.play(side,{self:h.unit('S',10000,[renamed,h.wait()]),opp:h.unit('E',10000,[h.wait()]),
        oppBench:[h.unit('B',10000,[h.wait()])],turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(r[1].opp.statStages,stages(-1));assert.deepEqual(r[1].self.statStages,stages(1));
      assert.ok(legalActions(r[2].state,other).some((x:any)=>x.kind==='switch'),r[2].logs.join('\n'));
    });
    await check(`${side} 對手攻擊觸發繳械、屬性技不觸發，第三回合後不重掛`,async()=>{
      const attack={...h.wait(),name:'物理攻擊',category:'物理',power:0};
      const [yes]=await h.play(side,{self:h.unit('S',10000,[skill()],{speed:200}),opp:h.unit('E',10000,[attack])});assert.ok(h.statuses(yes.opp).includes('繳械'));
      const [no]=await h.play(side,{self:h.unit('S',10000,[skill()]),opp:h.unit('E',10000,[h.wait()])});assert.ok(!h.statuses(no.opp).includes('繳械'));
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',10000,[h.wait(),attack]),turns:(_,t)=>[t===1?0:1,t===4?1:0]},4);
      assert.ok(!h.statuses(r[3].opp).includes('繳械'));
    });
    await check(`${side} 五回合異常免疫反彈，期滿第六回合中毒正常落在自身`,async()=>{
      const poison=h.kitSkill('施毒',[a('status',{side:'opp',status:'中毒',chance:100,turns:3})]);
      poison.kit.unshift(structuredClone(defs[0].kit[0]));
      const r=await h.play(side,{self:h.unit('S',100000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',100000,[poison,h.wait()]),turns:(_,t)=>[t===1?0:1,t>=5?0:1]},6);
      for(const row of r.slice(0,5))assert.ok(!h.statuses(row.self).includes('中毒'));
      assert.ok(h.statuses(r[4].opp).includes('中毒'),'第5回合仍反彈毒實際附加對手');
      assert.ok(h.statuses(r[5].self).includes('中毒'),'免疫期限後中毒附加自身');
    });
    await check(`${side} 下兩回合全類別受傷提升150%，100→250→250→100`,async()=>{
      for(const type of ['固定','百分比','技能','真實']){
        const hit=h.kitSkill('測量',[a('dmg',{flat:100,type,...(type==='技能'?{elem:'普通'}:{})})]);
        const r=await h.play(side,{self:h.unit('S',10000,[skill(),hit]),opp:h.unit('E',10000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},4);
        const loss=r.slice(1).map((x,i)=>r[i].opp.currentHp-x.opp.currentHp);
        assert.deepEqual(loss,[250,250,100],type+': '+r[3].logs.join('\n'));
      }
    });
    await check(`${side} 下兩回合先制+2實際排序，到期恢復；附加封印與換人不留下監控`,async()=>{
      const order:string[]=[];h.S.S=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('S');};h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('E');};
      try{await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{speed:10}),opp:h.unit('E',10000,[{...h.wait(),priority:1}],{speed:500}),turns:(_,t)=>[t===1?0:1,0]},4);
        assert.deepEqual(order,['E','S','S','E','S','E','E','S']);
      }finally{delete h.S.S;delete h.S.E;}
      const [sealed]=await h.play(side,{self:h.unit('S',10000,[skill()],{extra:{isAdditionalInvalid:true}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(sealed.state[`${side}Timers`].length,0);
      const r=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()]),turns:(_,t)=>[t===2?{switch:1}:0,0]},3);
      assert.equal(r[2].self.id,'B');assert.deepEqual(r[2].self.statStages,{});
    });
  }
  assert.equal(calls,0);console.log(`${checks} 蟲群庇護完整遷移與全能力查詢通過`);
}finally{delete h.S.S;delete h.S.E;if(old===undefined)delete registry['蟲群庇護'];else registry['蟲群庇護']=old;await h.close();}
