import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_CLEARED_REACTION_SKILL_KITS as definitions} from '../src/data/migratedClearedReactionSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>({...h.find('5013','蒼白冥步'),power:0,category:'屬性',isSureHit:true});
const clear=()=>h.kitSkill('消除對手回合',[{op:'clear_turn',p:{side:'opp'}}]);
try{
  await check('完整原文與Kit路由、Blockly真正保存重載，新事件具有正式節點',async()=>{
    const loaded=skill();assert.equal(loaded.description,definitions[0].description);h.assertKitOnly(loaded);assert.deepEqual(loaded.kit,definitions[0].kit);
    const {EFFECT_NODES}=await h.server.ssrLoadModule('/src/effects/effectNodes.ts');const {EffectTiming}=await h.server.ssrLoadModule('/src/effects/types.ts');
    assert.equal(EFFECT_NODES.on_turn_effects_cleared.event,EffectTiming.TURN_EFFECTS_CLEARED);
    defineCustomBlocks();const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
    try{
      for(const entry of loaded.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
      const entries=restored.getTopBlocks(false).map(block=>{const old=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,old.node,old.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(entries,loaded.kit);
    }finally{workspace.dispose();restored.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} Blockly改監控1回合並重載；次回合仍有其他效果被清掉，但不再凝滯`,async()=>{
      const active=skill();defineCustomBlocks();const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
      try{
        const entry=active.kit[5];buildEntryBlock(workspace as any,entry);
        const action=workspace.getAllBlocks(false).find(b=>b.type==='sequence_action'&&b.getFieldValue('OP')==='timed');assert.ok(action);
        const params=JSON.parse(action.getFieldValue('PARAMS'));action.setFieldValue(JSON.stringify({...params,turns:1}),'PARAMS');
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
        active.kit=structuredClone(active.kit);active.kit[5]=createKitBlockParser('skill')(restored.getTopBlocks(false)[0],entry.node,entry.order);
      }finally{workspace.dispose();restored.dispose();}
      const history=await h.play(side,{self:h.unit('S',50000,[active,h.wait()]),opp:h.unit('E',50000,[h.wait(),clear()]),turns:(_,turn)=>[turn===1?0:1,turn===1?0:1]},2);
      assert.ok(history[1].logs.some((line:string)=>line.includes('消除了回合類效果')));
      assert.equal(h.statuses(history[1].self).includes('凝滯'),false);assert.equal(h.statuses(history[1].opp).includes('凝滯'),false);
    });
    await check(`${side} 監控本身被清除仍雙方凝滯一次；受保護清除失敗不觸發`,async()=>{
      for(const protectedState of [false,true]){
        const [r]=await h.play(side,{self:h.unit('S',50000,[skill()],{extra:{ownTurnEffectsUnclearable:protectedState}}),opp:h.unit('E',50000,[clear()])});
        assert.equal(h.statuses(r.self).includes('凝滯'),!protectedState,r.logs.join('\n'));
        assert.equal(h.statuses(r.opp).includes('凝滯'),!protectedState,r.logs.join('\n'));
        if(!protectedState)assert.equal(r.logs.filter((line:string)=>line.includes('陷入了【凝滯】')).length,2);
      }
    });
    await check(`${side} 3回合自然到期不算被消除；第4回合不反應`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()]),opp:h.unit('E',50000,[h.wait(),clear()]),turns:(_,turn)=>[turn===1?0:1,turn===4?1:0]},4);
      for(const r of history){assert.equal(h.statuses(r.self).includes('凝滯'),false);assert.equal(h.statuses(r.opp).includes('凝滯'),false);}
    });
    await check(`${side} 換人不當被消除，監控不移交後備精靈`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[skill()]),selfBench:[h.unit('B',50000,[h.wait()])],opp:h.unit('E',50000,[h.wait(),clear()]),turns:(_,turn)=>[turn===1?0:{switch:1},turn===1?0:1]},2);
      assert.equal(history[1].self.id,'B');assert.equal(h.statuses(history[1].self).includes('凝滯'),false);assert.equal(h.statuses(history[1].opp).includes('凝滯'),false);
    });
    await check(`${side} 必中攻擊突破閃避才清2個非零PP槽；閃避或屬性技能不清`,async()=>{
      for(const mode of ['sure','evaded','utility']){
        const attack={...h.wait(),name:'測試攻擊',category:mode==='utility'?'屬性':'物理',power:mode==='utility'?0:1,pp:4,isSureHit:mode==='sure'};
        const [r]=await h.play(side,{self:h.unit('S',50000,[skill()]),opp:h.unit('E',50000,[attack,{...h.wait(),pp:5},{...h.wait(),name:'另一招',pp:6}])});
        assert.equal(r.opp.skills.filter((s:any)=>s.pp===0).length,mode==='sure'?2:0,r.logs.join('\n'));
        assert.equal(r.self.currentHp<50000,mode==='sure',r.logs.join('\n'));
      }
    });
    await check(`${side} 清回合成功只清屬性PP，空回合效果不清；條件先制3→4分離`,async()=>{
      const {readBasePriority,readSkillProperty}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
      for(const down of [false,true]){
        const ctx={actor:side,targetSide:side==='p1'?'p2':'p1',self:{},target:{statStages:down?{atk:-1}:{}},getPlayerState:()=>0,getOpponentState:()=>0};
        assert.equal(readBasePriority(skill(),ctx),down?4:3);assert.equal(readSkillProperty(skill(),'sure_hit',ctx),down?true:undefined);
      }
      for(const hasEffect of [false,true]){
        // 隔離「消除成功清屬性PP」；必中攻擊後的隨機清槽已由上一項獨立驗證。
        const active=skill();active.kit=active.kit.filter((entry:any)=>entry.order!==4);
        const history=await h.play(side,{self:h.unit('S',50000,[h.wait(),active]),opp:h.unit('E',50000,[h.turnEffectSkill(),{...h.wait(),name:'敵物理',category:'物理',power:1,pp:7,isSureHit:true}]),
          turns:(_,turn)=>[turn===1?0:1,turn===1?(hasEffect?0:1):1]},2);
        assert.equal(history[1].opp.skills[0].pp,hasEffect?0:99,history[1].logs.join('\n'));
      }
    });
  }
  console.log(`清回合反應遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
