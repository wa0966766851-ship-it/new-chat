import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_SELECTED_PP_SKILL_KITS as definitions} from '../src/data/migratedSelectedPpSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>({...h.find('5030','聖靈乾坤斷'),power:0,category:'屬性'});
try{
  await check('乾坤斷完整原文與Kit路徑、真正Blockly保存重載保留動態所選槽查詢',()=>{
    const def=definitions[0],loaded=skill();assert.equal(loaded.description,def.description);assert.equal(loaded.effectMode,'kit');assert.deepEqual(loaded.kit,def.kit);
    defineCustomBlocks();const workspace=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try{
      for(const entry of def.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),reload);
      const entries=reload.getTopBlocks(false).map(block=>{const entry=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,entry.node,entry.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(entries,def.kit);
    }finally{workspace.dispose();reload.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 同名兩槽只讀真正選中槽；耗盡才阻止行動並附加300真傷`,async()=>{
      for(const selected of [0,1]){
        const attack=h.kitSkill('同名攻擊',[{op:'dmg',p:{flat:31,type:'固定'}}],{category:'物理',power:1,pp:1,maxPp:99});
        const [result]=await h.play(side,{self:h.unit('S',5000,[skill()],{maxHp:10000,speed:200}),
          opp:h.unit('E',10000,[attack,{...attack,pp:3}]),turns:()=>[0,selected]});
        assert.equal(result.opp.currentHp,selected===0?9500:9800,result.logs.join('\n'));
        assert.equal(result.opp.skills[0].pp,0);
        assert.equal(result.opp.skills[1].pp,selected===0?2:1);
        if(selected===0)assert.equal(result.self.currentHp,5200);else assert.ok(result.self.currentHp<5200);
      }
    });
    await check(`${side} 固定吸取200→300→400→500→500；用本次使用次數，不重播舊fifthUses`,async()=>{
      const ramp=await h.play(side,{self:h.unit('S',10000,[skill()]),opp:h.unit('E',20000,[h.wait()])},5);
      assert.deepEqual(ramp.map((r:any)=>r.opp.currentHp),[19800,19500,19100,18600,18100],ramp[4].logs.join('\n'));
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5030');
      const [result]=await h.play(side,{self:h.unit('S',10000,[skill()],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',100000,[h.wait()])});
      assert.equal(result.state[`${side}RegistryState`]['holyMiles.fifthUses']||0,0,result.logs.join('\n'));
      assert.equal(result.state[`${side}RegistryState`]['blkUses:聖靈乾坤斷'],1);
    });
  }
  console.log(`所選PP遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
