import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_LIFESTEAL_SKILL_KITS as definitions} from '../src/data/migratedLifestealSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>({...h.find('5011','星光·究極吸取'),power:1,isSureHit:true});
try{
  await check('2份全文、持有者與正式Kit路徑；Blockly保存重載',()=>{
    for(const def of definitions){const loaded=h.find(def.elfIds[0],def.name);assert.equal(loaded.description,def.description);
    assert.equal(loaded.effectMode,'kit');assert.deepEqual(loaded.kit,def.kit);defineCustomBlocks();
    const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
    try{
      for(const entry of loaded.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
      const entries=restored.getTopBlocks(false).map(block=>{const entry=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,entry.node,entry.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(entries,loaded.kit);
    }finally{workspace.dispose();restored.dispose();}
    }
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 崩解：强化條件讀使用前狀態，吸取按每次技能觸發、4回合到期`,async()=>{
      const halfPercent={name:'百分比減半',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,
        params:{clause:{raw:'百分比減半',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce:.5},label:'百分比減半'}]}]}}}]};
      for(const boosted of [false,true]){
        const history=await h.play(side,{
          self:h.unit('S',10000,[{...h.find('5024','崩解・萬念劫灰'),power:0,category:'屬性'},h.wait()],{statStages:boosted?{atk:1}:{}}),
          opp:h.unit('E',100000,[h.wait()],{extra:{trait:halfPercent}}),turns:(_,turn)=>[turn===1?0:1,0],
        },5);
        assert.equal(history[0].self.statStages.def,boosted?2:1,history[0].logs.join('\n'));
        assert.equal(history[0].self.statStages.atk,boosted?3:1);
        assert.deepEqual(history.map(result=>result.opp.currentHp),[83334,66668,50002,33336,33336]);
      }
    });
    await check(`${side} 崩解：百分比免疫才補真傷；原持有者不寫舊吸取狀態`,async()=>{
      const percentGuard={name:'百分比免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,
        params:{clause:{raw:'免疫百分比',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce:1},label:'免疫百分比'}]}]}}}]};
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5024');
      const [result]=await h.play(side,{
        self:h.unit('S',10000,[{...h.find('5024','崩解・萬念劫灰'),power:0,category:'屬性'}],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),
        opp:h.unit('E',100000,[h.wait()],{extra:{trait:percentGuard}}),
      });
      assert.equal(result.opp.currentHp,99750,result.logs.join('\n'));
      assert.equal(result.state[`${side}RegistryState`].drainHpTurns||0,0);
    });
    await check(`${side} 崩解：零上限與傷害轉恢復不再當成百分比免疫`,async()=>{
      for(const conversion of [false,true]){
        const op=conversion?'absorb_now':'damage_cap_turns';
        const guard={name:'零傷害其他原因',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'mechanic',role:'innate',order:0,
          params:{clause:{raw:'零傷害其他原因',trig:'entrance',parsed:true,body:[{acts:[{op,p:conversion?{}:{side:'self',dir:'in',kind:'百分比',cap:0,turns:2},label:op}]}]}}}]};
        const [r]=await h.play(side,{self:h.unit('S',10000,[{...h.find('5024','崩解・萬念劫灰'),power:0,category:'屬性'}],{maxHp:20000}),opp:h.unit('E',50000,[h.wait()],{maxHp:60000,extra:{trait:guard}})});
        assert.equal(r.opp.currentHp,conversion?60000:50000,r.logs.join('\n'));assert.equal(r.self.currentHp,10000);
      }
    });
    await check(`${side} 攻擊吸血與固定吸取分開；異常附加只等於攻擊傷害，不含固定240`,async()=>{
      const results=[];
      for(const abnormal of [false,true]){
        const [result]=await h.play(side,{self:h.unit('S',5000,[skill()],{maxHp:10000}),opp:h.unit('E',20000,[h.wait()],{extra:abnormal?{battleStatuses:{狂暴:{duration:3}},effects:[{id:'狂暴',name:'狂暴',duration:3}]}:{}})});
        results.push(result);
      }
      const attack=20000-results[0].opp.currentHp-240;assert.ok(attack>0);
      assert.equal(results[0].self.currentHp,5240+attack,results[0].logs.join('\n'));
      assert.equal(results[1].self.currentHp,5240+attack,results[1].logs.join('\n'));
      assert.equal(results[1].opp.currentHp,19760-2*attack,results[1].logs.join('\n'));
    });
    await check(`${side} 吸強成功才產生300護盾；無提升時沒有護盾`,async()=>{
      for(const boosted of [false,true]){
        const [result]=await h.play(side,{self:h.unit('S',5000,[skill()],{maxHp:10000}),opp:h.unit('E',20000,[h.wait()],{statStages:boosted?{def:2}: {}})});
        assert.equal(result.self.shield||0,boosted?300:0,result.logs.join('\n'));
        assert.equal(result.self.statStages.def||0,boosted?2:0);
        assert.equal(result.opp.statStages.def||0,0);
      }
    });
    await check(`${side} 改名圖紙仍執行吸取；後續等待不重播`,async()=>{
      const history=await h.play(side,{self:h.unit('S',5000,[{...skill(),name:'自訂究極圖紙',description:''},h.wait()],{maxHp:10000}),opp:h.unit('E',20000,[h.wait()]),turns:(_,turn)=>[turn===1?0:1,0]},2);
      assert.equal(history[1].opp.currentHp,history[0].opp.currentHp);
      assert.equal(history[1].self.currentHp,history[0].self.currentHp);
      assert.ok(history[0].self.currentHp>5240);
    });
  }
  console.log(`攻擊吸血遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
