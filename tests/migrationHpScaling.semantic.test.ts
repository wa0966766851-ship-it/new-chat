import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_HP_SCALING_SKILL_KITS as definitions} from '../src/data/migratedHpScalingSkillKits';
import {sequenceIssue,sequenceClause} from '../src/effects/sequenceContract';
import {parseLine} from '../src/blocks/parse';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>({...h.find('5009','負岳勢'),power:0,category:'屬性'});
try{
  await check('負岳完整原文、正式Kit與Blockly保存重載，拒絕無效體力差參數',()=>{
    const def=definitions[0],loaded=skill();assert.equal(loaded.description,def.description);assert.equal(loaded.effectMode,'kit');assert.deepEqual(loaded.kit,def.kit);
    defineCustomBlocks();const workspace=new Blockly.Workspace(),reload=new Blockly.Workspace();
    try{
      for(const entry of def.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),reload);
      const entries=reload.getTopBlocks(false).map(block=>{const entry=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,entry.node,entry.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(entries,def.kit);
    }finally{workspace.dispose();reload.dispose();}
    const clause:any=structuredClone(def.kit[3].params.clause);assert.equal(sequenceIssue(clause,'on_skill_use'),null);
    const parsed=parseLine(clause.raw);assert.equal(parsed.parsed,true);assert.equal(parsed.body.length,1);
    assert.deepEqual(parsed.body[0].acts[0].p,clause.body[0].acts[0].p);assert.equal(sequenceIssue(sequenceClause(parsed),'on_skill_use'),null);
    for(const unit of [0,-1,1.5,NaN,Infinity]){clause.body[0].acts[0].p.hpGapUnit=unit;assert.ok(sequenceIssue(clause,'on_skill_use'));}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 百萬體力差邊界、負差、整數階梯與+6上限`,async()=>{
      for(const [gap,expected] of [[-1,1],[999999,1],[1000000,2],[1999999,2],[2000000,3],[10000000,6]]){
        const [result]=await h.play(side,{self:h.unit('S',1000000+gap,[skill()]),opp:h.unit('E',1000000,[h.wait()])});
        for(const stat of ['atk','def','spatk','spdef','speed','accuracy'])assert.equal(result.self.statStages[stat],expected,result.logs.join('\n'));
      }
    });
    await check(`${side} 實際轉移弱化才使下次技能無效；免疫留下弱化而不封招`,async()=>{
      const immune={name:'能力下降免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'mechanic',role:'innate',order:0,
        params:{clause:{raw:'免疫能力下降',trig:'entrance',parsed:true,body:[{acts:[{op:'immune_statdown_turns',p:{turns:3},label:'免疫能力下降'}]}]}}}]};
      for(const protectedOpponent of [false,true]){
        const [result]=await h.play(side,{self:h.unit('S',20000,[skill()],{statStages:{atk:-2}}),opp:h.unit('E',100000,[h.kitSkill('附加17',[{op:'dmg',p:{flat:17,type:'固定'}}])],{extra:protectedOpponent?{trait:immune}:{}})});
        assert.equal(result.opp.statStages.atk||0,protectedOpponent?0:-2,result.logs.join('\n'));
        assert.equal(result.self.statStages.atk,protectedOpponent?-1:1);
        assert.equal(result.self.currentHp,protectedOpponent?19983:20000);
      }
    });
  }
  console.log(`體力差能力遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
